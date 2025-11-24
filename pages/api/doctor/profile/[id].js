import dbConnect from '../../../../lib/database';
import DoctorProfile from '../../../../models/DoctorProfile';
import User from '../../../../models/Users';

export default async function handler(req, res) {
  await dbConnect();

  const { method } = req;
  if (method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Doctor id is required' });
  }

  try {
    const profile = await DoctorProfile.findById(id)
      .populate({ path: 'user', model: User, select: 'name email phone' })
      .lean();

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}



