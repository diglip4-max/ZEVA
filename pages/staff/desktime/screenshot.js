// pages/staff/desktime/screenshot.js
import { screenshotService } from '../../../../lib/screenshot-service';
import dbConnect from '../../../../lib/database';
import Screenshot from '../../../../models/Screenshot';
import jwt from 'jsonwebtoken';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
    });
  }
  
  console.log('Desk Time Screenshot API called');
  
  try {
    // AUTHENTICATION
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Missing or invalid authorization header');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified:', { 
        agentId: decoded.agentId || decoded.id,
        userId: decoded.userId,
      });
    } catch (jwtError) {
      console.warn('JWT verification failed:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
      });
    }
    
    // Extract agent ID (support multiple token formats)
    const agentId = decoded.agentId || decoded.id || decoded.userId || decoded._id;
    
    if (!agentId) {
      console.warn('No agent ID found in token');
      return res.status(400).json({
        success: false,
        message: 'Invalid token format. Agent ID not found.',
      });
    }
    
    console.log(`Processing screenshot for agent: ${agentId}`);
    
    // VALIDATE REQUEST BODY
    const { 
      imageData, 
      sessionId, 
      metadata = {},
      compress = true 
    } = req.body;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided. Please provide a base64 image.',
      });
    }
    
    // Basic base64 validation
    const isValidBase64 = this.validateBase64(imageData);
    if (!isValidBase64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Please provide a valid base64 image.',
      });
    }

    // CAPTURE AND UPLOAD SCREENSHOT
    console.log('Uploading screenshot to screenshot Cloudinary account...');
    
    let agentScreenshot;
    try {
      agentScreenshot = await screenshotService.captureAndUpload(
        imageData,
        agentId,
        {
          sessionId,
          windowTitle: metadata.windowTitle,
          appName: metadata.appName,
          compress,
        }
      );
      
      console.log(` Screenshot uploaded successfully to dggxzfnyz account`);
      
    } catch (uploadError) {
      console.error(' Screenshot upload failed:', uploadError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to upload screenshot to cloud storage.',
        error: uploadError.message,
        suggestion: 'Please check your screenshot Cloudinary account configuration.',
      });
    }
    
    // SAVE TO DATABASE
    console.log('Saving screenshot metadata to database...');
    
    let savedScreenshot;
    try {
      await dbConnect();
      
      savedScreenshot = await Screenshot.create({
        agentId,
        sessionId: sessionId || null,
        url: agentScreenshot.url,
        publicId: agentScreenshot.publicId,
        cloudinaryAccount: 'screenshot',
        cloudinaryCloudName: 'dggxzfnyz',
        timestamp: agentScreenshot.timestamp,
        metadata: agentScreenshot.metadata,
        uploadedAt: new Date(),
      });
      
      console.log(`Screenshot saved to database with ID: ${savedScreenshot._id}`);
      
    } catch (dbError) {
      console.error('Failed to save to database (screenshot still uploaded to Cloudinary):', dbError);
    }
    
    // 5. RETURN SUCCESS RESPONSE
    return res.status(201).json({
      success: true,
      message: 'Screenshot captured and saved successfully.',
      screenshot: {
        id: savedScreenshot?._id || 'not-saved-to-db',
        url: agentScreenshot.url,
        publicId: agentScreenshot.publicId,
        timestamp: agentScreenshot.timestamp,
        agentId,
        sessionId,
        metadata: agentScreenshot.metadata,
        cloudinaryAccount: 'screenshot',
        cloudinaryCloud: 'dggxzfnyz',
      },
      storageInfo: {
        account: 'screenshot (dggxzfnyz)',
        preset: 'desktime_screenshots',
        folder: `desktime/screenshots/${new Date().toISOString().split('T')[0]}/agent-${agentId}`,
      },
    });
    
  } catch (error) {
    console.error('Unexpected error in screenshot API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing screenshot.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Helper function to validate base64
function validateBase64(base64String) {
  if (typeof base64String !== 'string') return false;
  
  // Check if it's a data URL
  if (base64String.startsWith('data:image/')) {
    const matches = base64String.match(/^data:image\/[a-zA-Z]+;base64,/);
    if (!matches) return false;
    
    const base64Data = base64String.replace(matches[0], '');
    try {
      return btoa(atob(base64Data)) === base64Data;
    } catch {
      return false;
    }
  }
  
  // Check if it's plain base64
  try {
    return btoa(atob(base64String)) === base64String;
  } catch {
    return false;
  }
}