import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import {
  generateCertificate,
  getUserCertificates,
  verifyCertificate
} from '../controllers/certificateController.js';

const router = express.Router();







// Diagnostic endpoint to test auth middleware
router.get('/test-auth', authenticate, (req, res) => {
  console.log('🔐 Auth test endpoint hit');
  console.log('👤 User:', { id: req.user.id, email: req.user.email });
  res.json({ 
    success: true, 
    message: 'Authentication working',
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    timestamp: new Date().toISOString()
  });
});

// Test database queries only
router.get('/test-db/:courseId', authenticate, async (req, res) => {
  console.log('📊 Database test endpoint hit');
  const { courseId } = req.params;
  const userId = req.user.id;
  
  try {
    console.log('Testing enrollment query...');
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();
    
    console.log('Testing course query...');
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    
    res.json({
      success: true,
      message: 'Database queries completed',
      results: {
        enrollment: {
          found: !!enrollment,
          error: enrollmentError?.message
        },
        course: {
          found: !!course,
          error: courseError?.message
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test PDF generation only
router.get('/test-pdf', (req, res) => {
  console.log('📄 PDF test endpoint hit');
  
  try {
    // Import PDFDocument here to test if it's available
    import('pdfkit').then(({ default: PDFDocument }) => {
      console.log('PDFDocument imported successfully');
      
      const doc = new PDFDocument();
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('PDF generated successfully, size:', buffer.length);
        res.json({
          success: true,
          message: 'PDF generation test successful',
          pdfSize: buffer.length
        });
      });
      
      doc.fontSize(20).text('Test PDF', 100, 100);
      doc.end();
      
    }).catch(error => {
      console.error('PDFDocument import error:', error);
      res.status(500).json({
        success: false,
        error: 'PDFDocument import failed: ' + error.message
      });
    });
  } catch (error) {
    console.error('PDF test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Cloudinary config
router.get('/test-cloudinary', (req, res) => {
  console.log('☁️  Cloudinary test endpoint hit');
  
  res.json({
    success: true,
    message: 'Cloudinary config test',
    config: {
      cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: !!process.env.CLOUDINARY_API_KEY,
      apiSecret: !!process.env.CLOUDINARY_API_SECRET,
      cloudNameValue: process.env.CLOUDINARY_CLOUD_NAME
    }
  });
});

// Simplified test certificate generation (no PDF, no Cloudinary)
router.post('/test-generate/:courseId', authenticate, async (req, res) => {
  console.log('\n🧪 === TEST CERTIFICATE GENERATION START ===');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📚 Course ID:', req.params.courseId);
  console.log('👤 User ID:', req.user?.id);
  
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    console.log('\n📊 STEP 1: Testing database queries');
    
    // Test enrollment query
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (
          id,
          title,
          instructorId,
          users!courses_instructorId_fkey (
            firstName,
            lastName
          )
        )
      `)
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();
    
    console.log('✅ Enrollment query completed');
    console.log('📊 Enrollment found:', !!enrollment);
    console.log('❌ Enrollment error:', enrollmentError);
    
    if (enrollmentError || !enrollment) {
      return res.json({
        success: false,
        message: 'Enrollment not found',
        debug: { enrollmentError, userId, courseId }
      });
    }
    
    // Test user query
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('firstName, lastName, email')
      .eq('id', userId)
      .single();
    
    console.log('✅ User query completed');
    console.log('📊 User found:', !!user);
    console.log('❌ User error:', userError);
    
    if (userError || !user) {
      return res.json({
        success: false,
        message: 'User not found',
        debug: { userError }
      });
    }
    
    // Generate mock certificate (no PDF, no Cloudinary)
    const certificateId = `TEST-CERT-${Date.now()}`;
    const mockCertificateUrl = `https://example.com/certificates/${certificateId}.pdf`;
    
    console.log('\n📊 STEP 2: Creating mock certificate record');
    
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert({
        id: certificateId,
        userId,
        courseId,
        certificateUrl: mockCertificateUrl,
        issuedAt: new Date().toISOString(),
        metadata: {
          studentName: `${user.firstName} ${user.lastName}`,
          courseName: enrollment.courses.title,
          instructorName: `${enrollment.courses.users.firstName} ${enrollment.courses.users.lastName}`,
          completionDate: new Date().toISOString(),
          testMode: true
        }
      })
      .select()
      .single();
    
    console.log('✅ Certificate insert completed');
    console.log('📊 Certificate created:', !!certificate);
    console.log('❌ Certificate error:', certError);
    
    if (certError) {
      return res.json({
        success: false,
        message: 'Failed to create certificate record',
        debug: { certError }
      });
    }
    
    console.log('🎉 === TEST CERTIFICATE GENERATION SUCCESS ===');
    
    res.json({
      success: true,
      certificate,
      message: 'Test certificate generated successfully (no PDF)',
      debug: {
        enrollment: !!enrollment,
        user: !!user,
        certificateCreated: !!certificate
      }
    });
    
  } catch (error) {
    console.error('💥 === TEST CERTIFICATE GENERATION ERROR ===');
    console.error('❌ Error:', error.message);
    console.error('📍 Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Test certificate generation failed',
      error: error.message
    });
  }
});

router.post('/generate/:courseId', authenticate, generateCertificate);

// Get user's certificates
router.get('/my-certificates', authenticate, getUserCertificates);
router.get('/user', authenticate, getUserCertificates);

// Verify certificate (public endpoint)
router.get('/verify/:certificateId', verifyCertificate);

// Debug certificate generation
router.get('/debug/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (
          id,
          title,
          instructorId,
          users!courses_instructorId_fkey (
            firstName,
            lastName
          )
        )
      `)
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    res.json({
      success: true,
      enrollment,
      error,
      userId,
      courseId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/file/:certificateId', (req, res) => {
  try {
    const { certificateId } = req.params;
    const filePath = path.join(process.cwd(), 'certificates', `${certificateId}.pdf`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Certificate file not found'
      });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Certificate-${certificateId}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to serve certificate'
    });
  }
});

// Delete certificate
router.delete('/delete/:certificateId', authenticate, async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user.id;

    // Verify user owns this certificate
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', certificateId)
      .eq('userId', userId)
      .single();

    if (error || !certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .eq('id', certificateId)
      .eq('userId', userId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete certificate'
      });
    }

    // Delete local file if exists
    const filePath = path.join(process.cwd(), 'certificates', `${certificateId}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      message: 'Certificate deleted successfully'
    });

  } catch (error) {
    console.error('Certificate delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete certificate'
    });
  }
});

router.get('/download/:certificateId', authenticate, async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user.id;

    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', certificateId)
      .eq('userId', userId)
      .single();

    if (error || !certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    const filePath = path.join(process.cwd(), 'certificates', `${certificateId}.pdf`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Certificate file not found'
      });
    }
    
    const pdfBuffer = fs.readFileSync(filePath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate-${certificateId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download certificate',
      error: error.message
    });
  }
});

// Get certificate for specific course
router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch certificate'
      });
    }

    res.json({
      success: true,
      certificate: certificate || null
    });

  } catch (error) {
    console.error('Get course certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;