import dbConnect from '../../../lib/database';
import Enquiry from '../../../models/Enquiry';
import Review from '../../../models/Review';
import Clinic from '../../../models/Clinic';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId; // This is the clinic owner (user)

    // Get the clinic owned by this user
    const clinic = await Clinic.findOne({ owner: userId });
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    const clinicId = clinic._id;
   

    // Count reviews and enquiries for this clinic
    const [reviewCount, enquiryCount] = await Promise.all([
      Review.countDocuments({ clinicId }),
      Enquiry.countDocuments({ clinicId }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalReviews: reviewCount,
        totalEnquiries: enquiryCount,
      },
    });
  } catch (error) {
    console.error('Error fetching clinic dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
}
