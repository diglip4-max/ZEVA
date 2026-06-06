// Script to add Claims navigation item below Marketing
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Import model
const ClinicNavigationItemSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    index: false
  },
  path: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  badge: {
    type: Number,
    default: null
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClinicNavigationItem',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  moduleKey: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'clinic', 'doctor'],
    required: true
  },
  subModules: [{
    name: { type: String, required: true },
    path: { type: String },
    icon: { type: String, required: true },
    order: { type: Number, default: 0 },
    moduleKey: { type: String, required: true }
  }]
}, { timestamps: true });

const ClinicNavigationItem = mongoose.models.ClinicNavigationItem || mongoose.model('ClinicNavigationItem', ClinicNavigationItemSchema);

async function main() {
  try {
    console.log('Connecting to database...');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('Connected to database');

    // Claims navigation item data
    const claimsNavItem = {
      label: "Claims",
      path: "",
      icon: "📄",
      description: "Claims Management",
      badge: null,
      parentId: null,
      order: 14,
      isActive: true,
      moduleKey: "clinic_claims",
      role: "clinic",
      subModules: [
        {
          name: "Pass By Doctor",
          path: "/clinic/pass-claims",
          icon: "✅",
          order: 1,
          moduleKey: "pass_by_doctor"
        },
        {
          name: "Release Requested",
          path: "/clinic/release-requested-claims",
          icon: "🚀",
          order: 2,
          moduleKey: "release_requested"
        }
      ]
    };

    console.log('Checking if Claims navigation item exists...');
    const existing = await ClinicNavigationItem.findOne({ 
      role: 'clinic', 
      moduleKey: 'clinic_claims' 
    });

    if (existing) {
      console.log('Claims navigation item already exists. Updating...');
      Object.assign(existing, claimsNavItem);
      await existing.save();
      console.log('✅ Updated existing Claims navigation item');
    } else {
      console.log('Creating new Claims navigation item...');
      await ClinicNavigationItem.create(claimsNavItem);
      console.log('✅ Created new Claims navigation item');
    }

    // Now update order for items that come after claims
    console.log('Updating order for subsequent navigation items...');
    const result = await ClinicNavigationItem.updateMany(
      { 
        role: 'clinic', 
        order: { $gte: 14 } 
      },
      { $inc: { order: 1 } }
    );
    console.log(`Updated ${result.modifiedCount} items`);

    // Now set claims order to 14
    await ClinicNavigationItem.updateOne(
      { role: 'clinic', moduleKey: 'clinic_claims' },
      { order: 14 }
    );
    console.log('✅ Claims item order set to 14 (below Marketing)');

    console.log('Done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
