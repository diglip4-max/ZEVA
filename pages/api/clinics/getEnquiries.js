import dbConnect from '../../../lib/database';
import Enquiry from '../../../models/Enquiry';
import Clinic from '../../../models/Clinic'; // Import Clinic model
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);

    if (decoded.role !== 'clinic') {
      return res.status(403).json({ message: 'Access denied: not a clinic' });
    }

    // Step 1: Find the clinic associated with the user
    const clinic = await Clinic.findOne({ owner: decoded.userId });

    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    // Step 2: Fetch all enquiries by clinic._id
    const enquiries = await Enquiry.find({ clinicId: clinic._id }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, enquiries });
  } catch (err) {
    console.error('Fetch enquiries error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}
