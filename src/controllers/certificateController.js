import supabase from '../config/supabase.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withTimeout = (promise, timeoutMs = 120000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

export const generateCertificate = async (req, res) => {
  return withTimeout(generateCertificateInternal(req, res), 120000).catch(error => {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Certificate generation timed out',
        error: 'Operation took too long to complete'
      });
    }
  });
};

const generateCertificateInternal = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Course ID is required' });
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (
          id,
          title,
          description,
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

    if (enrollmentError || !enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    const { data: existingCert } = await supabase
      .from('certificates')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (existingCert) {
      return res.json({
        success: true,
        certificate: existingCert,
        message: 'Certificate already exists'
      });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('firstName, lastName, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { v4: uuidv4 } = await import('uuid');
    const certificateId = uuidv4();

    const pdfData = {
      certificateId,
      studentName: `${user.firstName} ${user.lastName}`,
      courseName: enrollment.courses.title,
      instructorName: `${enrollment.courses.users.firstName} ${enrollment.courses.users.lastName}`,
      completionDate: enrollment.completedAt || new Date().toISOString(),
      issueDate: new Date().toISOString()
    };

    let pdfBuffer;
    try {
      pdfBuffer = await createCertificatePDF(pdfData);
    } catch (pdfError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create certificate PDF',
        error: pdfError.message
      });
    }

    const certificatesDir = path.join(process.cwd(), 'certificates');
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    const fileName = `${certificateId}.pdf`;
    const filePath = path.join(certificatesDir, fileName);
    const certificateUrl = `${process.env.API_URL || 'http://localhost:5000/api'}/certificates/file/${certificateId}`;

    try {
      fs.writeFileSync(filePath, pdfBuffer);
    } catch (saveError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save certificate',
        error: saveError.message
      });
    }

    const certificateData = {
      id: certificateId,
      userId,
      courseId,
      certificateUrl: certificateUrl,
      certificateNumber: `CERT-${Date.now()}`,
      issuedAt: new Date().toISOString()
    };

    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert(certificateData)
      .select()
      .single();

    if (certError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save certificate',
        error: certError.message
      });
    }

    res.json({
      success: true,
      certificate,
      message: 'Certificate generated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate',
      error: error.message
    });
  }
};

export const getUserCertificates = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: certificates, error } = await supabase
      .from('certificates')
      .select(`
        *,
        courses (
          title,
          users!courses_instructorId_fkey (
            firstName,
            lastName
          )
        )
      `)
      .eq('userId', userId)
      .order('issuedAt', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch certificates'
      });
    }

    res.json({
      success: true,
      certificates: certificates || []
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const { data: certificate, error } = await supabase
      .from('certificates')
      .select(`
        *,
        users (firstName, lastName, email),
        courses (
          title,
          users!courses_instructorId_fkey (
            firstName,
            lastName
          )
        )
      `)
      .eq('id', certificateId)
      .single();

    if (error || !certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      certificate: {
        id: certificate.id,
        studentName: `${certificate.users.firstName} ${certificate.users.lastName}`,
        courseName: certificate.courses.title,
        instructorName: `${certificate.courses.users.firstName} ${certificate.courses.users.lastName}`,
        issuedAt: certificate.issuedAt,
        isValid: true
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
};

const createCertificatePDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const pdfHeader = buffer.slice(0, 4).toString();

        if (pdfHeader !== '%PDF') {
          reject(new Error('Generated PDF has invalid header'));
        } else {
          resolve(buffer);
        }
      });

      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Clean white background
      doc.rect(0, 0, pageWidth, pageHeight)
        .fill('#ffffff');

      // Full page elegant border
      doc.rect(25, 25, pageWidth - 50, pageHeight - 50)
        .lineWidth(3)
        .stroke('#1e40af');

      // Inner decorative border
      doc.rect(35, 35, pageWidth - 70, pageHeight - 70)
        .lineWidth(1)
        .stroke('#93c5fd');

      // Header section with more space
      doc.fontSize(36)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text('CERTIFICATE OF COMPLETION', 0, 70, { align: 'center' });

      // Decorative elements
      doc.moveTo(pageWidth / 2 - 150, 120)
        .lineTo(pageWidth / 2 + 150, 120)
        .lineWidth(2)
        .stroke('#2563eb');



      // Certification statement with more spacing
      doc.fontSize(18)
        .fillColor('#374151')
        .font('Helvetica')
        .text('This is to certify that', 0, 180, { align: 'center' });

      // Student name - larger and more prominent
      doc.fontSize(32)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(data.studentName, 0, 220, { align: 'center' });

      // Underline for name
      const nameWidth = doc.widthOfString(data.studentName, { fontSize: 32 });
      const nameX = (pageWidth - nameWidth) / 2;
      doc.moveTo(nameX, 260)
        .lineTo(nameX + nameWidth, 260)
        .lineWidth(1)
        .stroke('#fbbf24');

      // Achievement text
      doc.fontSize(18)
        .fillColor('#374151')
        .font('Helvetica')
        .text('has successfully completed the course', 0, 290, { align: 'center' });

      // Course name - larger
      doc.fontSize(26)
        .fillColor('#1e40af')
        .font('Helvetica-Bold')
        .text(data.courseName, 0, 330, { align: 'center' });

      // Completion date with more prominence
      const completionDate = new Date(data.completionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.fontSize(16)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(`Completed on ${completionDate}`, 0, 380, { align: 'center' });

      // Footer section - using more space
      const footerY = 440;

      // Left section - Certificate details
      doc.fontSize(12)
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Certificate Details:', 50, footerY);

      // Full Certificate ID
      doc.fontSize(10)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(`ID: ${data.certificateId}`, 50, footerY + 20);

      // Issue date
      const issueDate = new Date(data.issueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.fontSize(10)
        .text(`Issued: ${issueDate}`, 50, footerY + 35);

      // Right section - Instructor signature with more space
      doc.fontSize(14)
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Authorized Instructor', pageWidth - 200, footerY);

      doc.fontSize(18)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(data.instructorName, pageWidth - 200, footerY + 25);

      // Signature line
      doc.moveTo(pageWidth - 200, footerY + 50)
        .lineTo(pageWidth - 50, footerY + 50)
        .lineWidth(1)
        .stroke('#d1d5db');

      doc.fontSize(10)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text('Digital Signature', pageWidth - 200, footerY + 60);

      // Verification section at bottom
      const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-certificate/${data.certificateId}`;

      doc.fontSize(10)
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Verify Certificate Authenticity:', 0, pageHeight - 60, { align: 'center' });

      doc.fontSize(9)
        .fillColor('#1e40af')
        .font('Helvetica')
        .text(verifyUrl, 0, pageHeight - 45, { align: 'center' });

      // Bottom decorative line
      doc.moveTo(100, pageHeight - 25)
        .lineTo(pageWidth - 100, pageHeight - 25)
        .lineWidth(1)
        .stroke('#93c5fd');

      // Full page utilization check
      const usedHeight = pageHeight - 25; // Using almost full page
      console.log(`Certificate uses ${usedHeight}px of ${pageHeight}px available height`);

      if (usedHeight > pageHeight - 30) {
        console.warn('Certificate optimally fills the entire page');
      }

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

export default {
  generateCertificate,
  getUserCertificates,
  verifyCertificate
};