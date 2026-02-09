// pages/api/agent/work-session/arrival.js
import dbConnect from '../../../../lib/database';
import WorkSession from '../../../../models/WorkSession';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    await dbConnect();

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    const token = auth.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Debug log to see what's in the token
    console.log('Decoded token:', decoded);

    // Try different possible token structures
    const agentId = decoded.id || decoded.userId || decoded.agentId || decoded._id;

    if (!agentId) {
      console.error('No agentId found in token:', decoded);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token structure',
        // tokenContents: decoded // Remove this in production
      });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    let session = await WorkSession.findOne({
      agentId,
      date: { $gte: start, $lte: end },
    });

    if (!session) {
      session = await WorkSession.create({
        agentId,
        role: 'agent',
        date: start,
        arrivalTime: new Date(),
        deskTimeSeconds: 0,
        productiveSeconds: 0,
        productivityPercentage: 0,
      });
    } else if (!session.arrivalTime) {
      session.arrivalTime = new Date();
      await session.save();
    }

    return res.json({
      success: true,
      arrivalTime: session.arrivalTime,
    });
  } catch (err) {
    console.error('ARRIVAL ERROR:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: err.message 
    });
  }
}