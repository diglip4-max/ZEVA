// pages/api/clinics/search.ts
import dbConnect from '../../../lib/database';
import Clinic from '../../../models/Clinic';
import User from '../../../models/Users';

export default async function handler(req, res) {
  await dbConnect();
  const { q } = req.query;

  if (!q) return res.status(400).json({ message: 'Query is required' });

  const regex = new RegExp(q, 'i');

  try {
    // Fetch all approved clinics with their treatments
    const clinics = await Clinic.find({ isApproved: true })
      .populate({
        path: "owner",
        model: User,
        select: "name email phone isApproved declined role",
      })
      .select("treatments owner")
      .lean();

    // Filter only registered and available clinics
    const availableClinics = clinics.filter(
      (clinic) =>
        clinic.owner &&
        clinic.owner.isApproved === true &&
        clinic.owner.declined !== true &&
        clinic.owner.role === "clinic"
    );

    // Extract unique main treatments (no sub-treatments)
    const treatmentsSet = new Set();
    
    availableClinics.forEach((clinic) => {
      if (clinic.treatments && Array.isArray(clinic.treatments)) {
        clinic.treatments.forEach((treatment) => {
          // Only add main treatment, ignore sub-treatments
          if (treatment.mainTreatment && treatment.mainTreatment.trim()) {
            const mainTreatment = treatment.mainTreatment.trim();
            // Only add if it matches the search query
            if (regex.test(mainTreatment)) {
              treatmentsSet.add(mainTreatment);
            }
          }
        });
      }
    });

    // Convert to array of suggestions (only main treatments)
    const suggestions = Array.from(treatmentsSet).map((treatmentName) => ({
      type: 'treatment',
      value: treatmentName,
    }));

    return res.status(200).json({ treatments: suggestions });
  } catch (err) {
    console.error("Treatment search error:", err);
    return res.status(500).json({ message: 'Server error while fetching treatments' });
  }
}
