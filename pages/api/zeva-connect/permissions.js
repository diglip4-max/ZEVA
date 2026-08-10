import Clinic from "../../../models/Clinic";
import Users from "../../../models/Users";
import { getModulePermissions } from "../lead-ms/permissions-helper";
import { getAgentModulePermissions } from "../agent/permissions-helper";
import dbConnect from "../../../lib/database";

export default async function handler(req, res) {
  res.setHeader("Allow", ["GET"]);
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  // Step 1: confirm that verify request is from Zeva Connect (shared secret)
  const apiKey = req.headers["x-internal-api-key"] || "";
  console.log({ apiKey });

  if (apiKey !== process.env.ZEVA_CONNECT_INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    await dbConnect();

    const { userId, module, subModule } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }
    if (!module) {
      return res
        .status(400)
        .json({ success: false, message: "module is required" });
    }

    const user = await Users.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Get clinicId based on user role
    let clinicId;
    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id });
      if (!clinic) {
        return res.status(400).json({
          success: false,
          message: "Clinic not found for this user",
        });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent") {
      if (!user.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "Agent not tied to a clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor" || user.role === "doctorStaff") {
      if (!user.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "Doctor not tied to a clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin",
        });
      }
    } else {
      console.log({ userRole: user.role });
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    console.log({ user });

    let permissions = null;
    let moduleActions = null;
    let subModuleActions = null;
    if (user?.role === "clinic") {
      const clinicPermission = await getModulePermissions(clinicId, module);

      if (clinicPermission && clinicPermission.permissions) {
        const modulePermissions = clinicPermission?.permissions || null;
        const subModulePermission = modulePermissions?.subModules?.find(
          (item) => item.moduleKey === subModule,
        );
        permissions = modulePermissions;

        moduleActions = modulePermissions?.actions || {};
        subModuleActions = subModulePermission?.actions || {};
      }
    } else if (["agent", "doctor", "doctorStaff"].includes(user.role)) {
      const agentPermission = await getAgentModulePermissions(user._id, module);
      console.log({ agentPermission });
      if (agentPermission && agentPermission.permissions) {
        const modulePermissions = agentPermission?.permissions || null;
        const subModulePermission = modulePermissions?.subModules?.find(
          (item) => item.moduleKey === subModule,
        );
        permissions = modulePermissions;

        moduleActions = modulePermissions?.actions || {};
        subModuleActions = subModulePermission?.actions || {};
      }
    }
    console.log({ permissions });
    if (!permissions) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Permissions retrieved successfully",
      permissions,
      moduleActions,
      subModuleActions,
    });
  } catch (error) {
    console.error("Error connecting to database:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
