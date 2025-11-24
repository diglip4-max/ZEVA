// pages/api/clinic/verify-token.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ valid: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'clinic') {
      return res.status(403).json({ valid: false, message: 'Invalid role' });
    }

    return res.status(200).json({ valid: true, decoded });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, message: 'Token expired' });
    }

    return res.status(401).json({ valid: false, message: 'Invalid token' });
  }
}
