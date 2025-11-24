// lib/verifyAuth.js
import jwt from 'jsonwebtoken';
import User from '../../../models/Users';

export async function verifyAuth(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Use decoded.userId (since you store it in login API)
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return null;
    }

    return user;
  } catch (err) {
    console.error('verifyAuth error:', err);
    res.status(401).json({ success: false, error: 'Invalid token' });
    return null;
  }
}
