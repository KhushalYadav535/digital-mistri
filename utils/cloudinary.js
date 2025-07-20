import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dejav0pow',
  api_key: process.env.CLOUDINARY_API_KEY || '239964127998336',
  api_secret: process.env.CLOUDINARY_API_SECRET || '1AS2IFYFe9mXwS31ZH1gYTNJs3g',
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'digital-mistri',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' }, // Max size limit
      { quality: 'auto:good' }, // Auto quality optimization
      { fetch_format: 'auto' } // Auto format (WebP for supported browsers)
    ],
    resource_type: 'image',
  },
});

// Multer configuration with Cloudinary storage
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Function to generate optimized URLs for different sizes
export const getOptimizedImageUrl = (publicId, options = {}) => {
  const {
    width = 400,
    height = 400,
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format,
  });
};

// Function to generate multiple sizes for responsive images
export const getResponsiveImageUrls = (publicId) => {
  return {
    thumbnail: getOptimizedImageUrl(publicId, { width: 150, height: 150, crop: 'fill' }),
    small: getOptimizedImageUrl(publicId, { width: 300, height: 300, crop: 'fill' }),
    medium: getOptimizedImageUrl(publicId, { width: 600, height: 600, crop: 'fill' }),
    large: getOptimizedImageUrl(publicId, { width: 1000, height: 1000, crop: 'limit' }),
    original: cloudinary.url(publicId, { fetch_format: 'auto' })
  };
};

// Function to delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Function to upload image and return optimized URLs
export const uploadAndOptimize = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'digital-mistri',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      responsiveUrls: getResponsiveImageUrls(result.public_id)
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

export { cloudinary, storage, upload }; 