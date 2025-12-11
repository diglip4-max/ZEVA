import dbConnect from '../../../lib/database';
import Enquiry from '../../../models/Enquiry';
import Clinic from '../../../models/Clinic';
import User from '../../../models/Users';
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

    let clinicIdToUse = null;

    if (decoded.role === 'clinic') {
      const clinic = await Clinic.findOne({ owner: decoded.userId });
      if (!clinic) {
        return res.status(404).json({ message: 'Clinic not found' });
      }
      clinicIdToUse = clinic._id;
    } else if (decoded.role === 'agent' || decoded.role === 'doctor' || decoded.role === 'doctorStaff' || decoded.role === 'staff') {
      const user = await User.findById(decoded.userId).select('clinicId');
      if (!user?.clinicId) {
        return res.status(403).json({ message: 'Access denied: user not linked to any clinic' });
      }
      clinicIdToUse = user.clinicId;
    } else {
      return res.status(403).json({ message: 'Access denied: unsupported role' });
    }

    const enquiries = await Enquiry.find({ clinicId: clinicIdToUse }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, enquiries });
  } catch (err) {
    console.error('Fetch enquiries error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}
