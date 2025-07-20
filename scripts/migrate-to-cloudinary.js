import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { cloudinary, uploadAndOptimize } from '../utils/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Customer from '../models/Customer.js';
import NearbyShop from '../models/NearbyShop.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-mistri-dev';

async function migrateImages() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔄 Starting image migration to Cloudinary...');

    // Migrate customer profile images
    console.log('\n👤 Migrating customer profile images...');
    const customers = await Customer.find({ profileImage: { $exists: true, $ne: '' } });
    
    for (const customer of customers) {
      if (customer.profileImage && customer.profileImage.startsWith('/uploads/')) {
        try {
          const imagePath = path.join(__dirname, '..', customer.profileImage);
          
          if (fs.existsSync(imagePath)) {
            console.log(`📤 Uploading ${customer.profileImage} for customer ${customer.name}...`);
            
            const result = await uploadAndOptimize({ path: imagePath });
            
            // Update customer with Cloudinary URL
            await Customer.findByIdAndUpdate(customer._id, {
              profileImage: result.url
            });
            
            console.log(`✅ Migrated: ${customer.profileImage} → ${result.url}`);
          } else {
            console.log(`⚠️  File not found: ${imagePath}`);
          }
        } catch (error) {
          console.error(`❌ Error migrating ${customer.profileImage}:`, error.message);
        }
      }
    }

    // Migrate nearby shop images
    console.log('\n🏪 Migrating nearby shop images...');
    const shops = await NearbyShop.find({ images: { $exists: true, $ne: [] } });
    
    for (const shop of shops) {
      if (shop.images && shop.images.length > 0) {
        const newImages = [];
        
        for (const imagePath of shop.images) {
          if (imagePath.startsWith('/uploads/')) {
            try {
              const fullImagePath = path.join(__dirname, '..', imagePath);
              
              if (fs.existsSync(fullImagePath)) {
                console.log(`📤 Uploading ${imagePath} for shop ${shop.name}...`);
                
                const result = await uploadAndOptimize({ path: fullImagePath });
                newImages.push(result.url);
                
                console.log(`✅ Migrated: ${imagePath} → ${result.url}`);
              } else {
                console.log(`⚠️  File not found: ${fullImagePath}`);
                newImages.push(imagePath); // Keep original path
              }
            } catch (error) {
              console.error(`❌ Error migrating ${imagePath}:`, error.message);
              newImages.push(imagePath); // Keep original path
            }
          } else {
            newImages.push(imagePath); // Already a Cloudinary URL or other format
          }
        }
        
        // Update shop with new image URLs
        if (newImages.length > 0) {
          await NearbyShop.findByIdAndUpdate(shop._id, {
            images: newImages
          });
        }
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log('\n📊 Summary:');
    console.log(`- Customers processed: ${customers.length}`);
    console.log(`- Shops processed: ${shops.length}`);
    
    console.log('\n⚠️  Note: Old local files are still in the uploads folder.');
    console.log('   You can delete them manually after verifying the migration.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateImages(); 