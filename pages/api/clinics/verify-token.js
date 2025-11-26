// pages/api/clinic/verify-token.js
import jwt from 'jsonwebtoken';
import dbConnect from '../../../lib/database';
import Clinic from '../../../models/Clinic';
import User from '../../../models/Users';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await dbConnect();

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, message: 'Authorization header missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'clinic') {
      return res.status(403).json({ valid: false, message: 'Invalid role' });
    }

    const userId = decoded?.userId || decoded?.id;

    if (!userId) {
      return res.status(401).json({ valid: false, message: 'Invalid token format' });
    }

    // Find the clinic associated with this user
    const clinic = await Clinic.findOne({ owner: userId });

    if (!clinic) {
      return res.status(404).json({ valid: false, message: 'Clinic not found for this user' });
    }

    // Check if clinic is approved
    if (!clinic.isApproved) {
      return res.status(403).json({ valid: false, message: 'Clinic account not approved. Please wait for admin approval.' });
    }

    // Check if clinic is declined
    if (clinic.declined) {
      return res.status(403).json({ valid: false, message: 'Clinic account has been declined' });
    }

    // Verify user exists and has clinic role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }

    if (user.role !== 'clinic') {
      return res.status(403).json({ valid: false, message: 'Access denied. Clinic role required' });
    }

    return res.status(200).json({ 
      valid: true, 
      decoded,
      clinic: { id: clinic._id, name: clinic.name, isApproved: clinic.isApproved }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, message: 'Token expired' });
    }

    console.error('Clinic token verification error:', error);
    return res.status(401).json({ valid: false, message: 'Invalid token. Please login again' });
  }
}
