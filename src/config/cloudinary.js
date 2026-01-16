import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Video storage configuration
export const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'lms-videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }
    ]
  }
});

// Resource storage configuration
export const resourceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'lms-resources',
    resource_type: 'raw',
    use_filename: true,
    unique_filename: true,
    access_mode: 'public'
  }
});

export default cloudinary;