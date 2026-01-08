import dbConnect from '../../../lib/database';
import Treatment from '../../../models/Treatment';
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'POST') {
    const { name, slug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Treatment name is required' });
    }

    const trimmedName = name.trim();

    try {
      // Get the logged-in user
      const me = await getUserFromReq(req);
      if (!me) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
      }

      // If user is an agent, check create permission for add_treatment module
      if (['agent', 'doctorStaff'].includes(me.role)) {
        const { hasPermission, error: permissionError } = await checkAgentPermission(
          me._id,
          "add_treatment", // moduleKey
          "create", // action
          null // subModuleName
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: permissionError || "You do not have permission to create treatments"
          });
        }
      }
      // Admin users bypass permission checks
      // Check for duplicate treatment (case-insensitive)
      const exists = await Treatment.findOne({ 
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (exists) {
        return res.status(409).json({ message: 'Treatment already exists' });
      }

      const treatment = new Treatment({ 
        name: trimmedName,
        slug: slug || trimmedName.toLowerCase().replace(/\s+/g, '-'),
        subcategories: []
      });
      await treatment.save();

      return res.status(201).json({ message: 'Treatment added successfully', treatment });
    } catch (error) {
      console.error('Error adding treatment:', error);
      return res.status(500).json({ success: false, message: 'Failed to add treatment' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
