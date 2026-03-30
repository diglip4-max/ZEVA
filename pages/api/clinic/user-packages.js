import dbConnect from "../../../lib/database";
import UserPackage from "../../../models/UserPackage";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

export default async function handler(req, res) {
  await dbConnect();
  
  const { method } = req;

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  let user;
  try {
    user = await getAuthorizedStaffUser(req, { allowedRoles: ["clinic", "staff", "admin"] });
  } catch (err) {
    return res.status(err.status || 401).json({ success: false, message: err.message || "Authentication error" });
  }

  if (method === 'GET') {
    try {
      const { status, search } = req.query;
      const clinicId = user.clinicId;

      let query = { clinicId };

      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        query.approvalStatus = status;
      }

      const packages = await UserPackage.find(query)
        .populate({
          path: 'patientId',
          model: PatientRegistration,
          select: 'firstName lastName emrNumber',
        })
        .sort({ createdAt: -1 })
        .lean();

      let filteredPackages = packages;
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredPackages = packages.filter(pkg => {
          const patient = pkg.patientId;
          if (!patient) return false;
          const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
          return fullName.includes(searchTerm) || patient.emrNumber?.toLowerCase().includes(searchTerm);
        });
      }

      return res.status(200).json({ success: true, packages: filteredPackages });
    } catch (error) {
      console.error("Error fetching user packages:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch user packages" });
    }
  }

  res.setHeader('Allow', ['GET']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
