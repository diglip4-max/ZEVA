import dbConnect from "../../../lib/database";
import Department from "../../../models/Department";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic admin authentication
  let clinicUser;
  try {
    clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (clinicUser.role !== "clinic") {
      return res.status(403).json({ success: false, message: "Access denied. Clinic role required." });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Find the clinic associated with this user
  const clinic = await Clinic.findOne({ owner: clinicUser._id });
  if (!clinic) {
    return res.status(404).json({ success: false, message: "Clinic not found" });
  }

  const clinicId = clinic._id;

  // GET: Fetch all departments for this clinic
  if (req.method === "GET") {
    try {
      // Check read permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "read",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to view departments",
        });
      }

      const departments = await Department.find({ clinicId })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        departments: departments.map((dept) => ({
          _id: dept._id.toString(),
          name: dept.name,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch departments" });
    }
  }

  // POST: Create a new department
  if (req.method === "POST") {
    try {
      // Check create permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "create",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to create departments",
        });
      }

      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Department name is required" });
      }

      // Check if department with same name already exists for this clinic
      const existingDepartment = await Department.findOne({
        clinicId,
        name: name.trim(),
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: "A department with this name already exists",
        });
      }

      const newDepartment = await Department.create({
        clinicId,
        name: name.trim(),
        createdBy: clinicUser._id,
      });

      return res.status(201).json({
        success: true,
        message: "Department created successfully",
        department: {
          _id: newDepartment._id.toString(),
          name: newDepartment.name,
          createdAt: newDepartment.createdAt,
          updatedAt: newDepartment.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error creating department:", error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A department with this name already exists",
        });
      }
      return res.status(500).json({ success: false, message: "Failed to create department" });
    }
  }

  // PUT: Update an existing department
  if (req.method === "PUT") {
    try {
      // Check update permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "update",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to update departments",
        });
      }

      const { departmentId, name } = req.body;

      if (!departmentId || !name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Department ID and new name are required",
        });
      }

      const department = await Department.findOne({ _id: departmentId, clinicId });
      if (!department) {
        return res.status(404).json({ success: false, message: "Department not found" });
      }

      const normalizedName = name.trim();
      const duplicateDepartment = await Department.findOne({
        clinicId,
        name: normalizedName,
        _id: { $ne: departmentId },
      });

      if (duplicateDepartment) {
        return res.status(400).json({
          success: false,
          message: "Another department with this name already exists",
        });
      }

      department.name = normalizedName;
      await department.save();

      return res.status(200).json({
        success: true,
        message: "Department updated successfully",
        department: {
          _id: department._id.toString(),
          name: department.name,
          createdAt: department.createdAt,
          updatedAt: department.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating department:", error);
      return res.status(500).json({ success: false, message: "Failed to update department" });
    }
  }

  // DELETE: Delete a department
  if (req.method === "DELETE") {
    try {
      // Check delete permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "delete",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to delete departments",
        });
      }

      const { departmentId } = req.query;

      if (!departmentId) {
        return res.status(400).json({ success: false, message: "Department ID is required" });
      }

      // Verify the department belongs to this clinic
      const department = await Department.findOne({ _id: departmentId, clinicId });
      if (!department) {
        return res.status(404).json({ success: false, message: "Department not found" });
      }

      await Department.findByIdAndDelete(departmentId);

      return res.status(200).json({
        success: true,
        message: "Department deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      return res.status(500).json({ success: false, message: "Failed to delete department" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

