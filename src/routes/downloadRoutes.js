import express from 'express';
import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

const router = express.Router();

// Download resource with proper filename
router.get('/resource/:id', async (req, res) => {
  try {
    // Check authentication from query parameter or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    const { id } = req.params;
    
    // Get resource details
    const { data: resource, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    
    try {
      // Fetch file from Cloudinary
      const response = await fetch(resource.fileUrl);
      
      if (!response.ok) {
        return res.status(404).json({ message: 'File not accessible' });
      }
      
      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${resource.fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Stream the file
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
      
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(404).json({ message: 'File not accessible' });
    }
    
  } catch (error) {
    console.error('Download error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Download failed' });
  }
});

export default router;