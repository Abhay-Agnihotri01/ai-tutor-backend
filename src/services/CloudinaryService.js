import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Upload video to Cloudinary
  async uploadVideo(filePath, publicId, options = {}) {
    try {
      const defaultOptions = {
        resource_type: 'video',
        public_id: publicId,
        folder: 'live-class-recordings',
        overwrite: true,
        quality: 'auto',
        format: 'mp4',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      };

      const uploadOptions = { ...defaultOptions, ...options };
      
      console.log('Uploading video to Cloudinary:', { filePath, publicId });
      
      const result = await cloudinary.uploader.upload(filePath, uploadOptions);
      
      console.log('Video uploaded successfully:', result.public_id);
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        playbackUrl: result.playback_url || result.secure_url
      };
    } catch (error) {
      console.error('Error uploading video to Cloudinary:', error);
      throw new Error('Failed to upload video to Cloudinary');
    }
  }

  // Generate video thumbnail
  async generateThumbnail(publicId) {
    try {
      const thumbnailUrl = cloudinary.url(publicId, {
        resource_type: 'video',
        transformation: [
          { width: 640, height: 360, crop: 'fill' },
          { quality: 'auto' },
          { format: 'jpg' }
        ]
      });

      return thumbnailUrl;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw new Error('Failed to generate thumbnail');
    }
  }

  // Delete video from Cloudinary
  async deleteVideo(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video'
      });
      
      console.log('Video deleted from Cloudinary:', publicId);
      return result;
    } catch (error) {
      console.error('Error deleting video from Cloudinary:', error);
      throw new Error('Failed to delete video from Cloudinary');
    }
  }

  // Get video info
  async getVideoInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'video'
      });
      
      return {
        publicId: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        createdAt: result.created_at
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      throw new Error('Failed to get video info');
    }
  }

  // Generate signed upload URL for direct upload
  async generateSignedUploadUrl(publicId, options = {}) {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      
      const params = {
        public_id: publicId,
        folder: 'live-class-recordings',
        resource_type: 'video',
        timestamp: timestamp,
        ...options
      };

      const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
      
      return {
        url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
        params: {
          ...params,
          signature,
          api_key: process.env.CLOUDINARY_API_KEY
        }
      };
    } catch (error) {
      console.error('Error generating signed upload URL:', error);
      throw new Error('Failed to generate signed upload URL');
    }
  }

  // Upload raw files (like PDFs) to Cloudinary
  async uploadRaw(buffer, publicId, format = 'pdf') {
    console.log('\n☁️  === CLOUDINARY RAW UPLOAD START ===');
    console.log('   📏 Buffer size:', buffer.length, 'bytes');
    console.log('   🆔 Public ID:', publicId);
    console.log('   📄 Format:', format);
    
    return new Promise((resolve, reject) => {
      const uploadStartTime = Date.now();
      let uploadTimeout;
      
      try {
        console.log('   🔧 Cloudinary config check:');
        console.log('   - Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
        console.log('   - API key exists:', !!process.env.CLOUDINARY_API_KEY);
        console.log('   - API secret exists:', !!process.env.CLOUDINARY_API_SECRET);
        
        // Set timeout for upload
        uploadTimeout = setTimeout(() => {
          console.log('   ❌ Cloudinary upload timeout after 60 seconds');
          reject(new Error('Cloudinary upload timeout'));
        }, 60000);
        
        console.log('   🔄 Converting buffer to base64...');
        const base64Data = `data:application/pdf;base64,${buffer.toString('base64')}`;
        
        console.log('   🔄 Starting Cloudinary upload...');
        
        cloudinary.uploader.upload(
          base64Data,
          {
            resource_type: 'raw',
            public_id: `${publicId}.pdf`,
            folder: 'certificates',
            format: 'pdf'
          },
          (error, result) => {
            clearTimeout(uploadTimeout);
            const uploadDuration = Date.now() - uploadStartTime;
            
            if (error) {
              console.error('   ❌ Cloudinary upload failed!');
              console.error('   📋 Upload error:', error.message);
              console.error('   📋 Error details:', JSON.stringify(error, null, 2));
              console.error('   ⏱️  Failed after:', uploadDuration, 'ms');
              reject(new Error(`Cloudinary upload failed: ${error.message}`));
            } else {
              console.log('   ✅ Cloudinary upload successful!');
              console.log('   ⏱️  Upload time:', uploadDuration, 'ms');
              console.log('   🔗 Secure URL:', result.secure_url);
              console.log('   🆔 Public ID:', result.public_id);
              console.log('   📏 Uploaded size:', result.bytes, 'bytes');
              console.log('   📄 Format:', result.format);
              
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                bytes: result.bytes,
                format: result.format,
                resource_type: result.resource_type,
                created_at: result.created_at
              });
            }
          }
        );
        
      } catch (error) {
        clearTimeout(uploadTimeout);
        console.error('   ❌ Cloudinary upload setup error:');
        console.error('   📋 Error message:', error.message);
        console.error('   📍 Error stack:', error.stack);
        reject(error);
      }
    });
  }

  // Clean up local file after upload
  cleanupLocalFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Local file cleaned up:', filePath);
      }
    } catch (error) {
      console.error('Error cleaning up local file:', error);
    }
  }
}

export default new CloudinaryService();