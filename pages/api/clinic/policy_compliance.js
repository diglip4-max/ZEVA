import dbConnect from "../../../lib/database";
// import dbConnect from '../../../../lib/database';
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";
import SOP from "../../../models/SOP";
import Policy from "../../../models/Policy";
import Playbook from "../../../models/Playbook";
import Acknowledgment from "../../../models/Acknowledgment";
import User from "../../../models/Users";
import DoctorDepartment from "../../../models/DoctorDepartment";

export default async function handler(req, res) {
  await dbConnect();

  let user;
  try { 
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  let clinicId;
  if (user.role === "admin") {
    clinicId = req.query.clinicId || req.body.clinicId;
  } else {
    const resolved = await getClinicIdFromUser(user);
    clinicId = resolved.clinicId;
    if (resolved.error || !clinicId) {
      return res.status(403).json({ success: false, message: resolved.error || "Unable to determine clinic access" });
    }
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // Resolve agent/doctorStaff/staff department names from DoctorDepartment model
  // Used to filter SOPs/Policies/Playbooks by matching the document's department
  // against the logged-in agent's assigned departments.
  let agentDepartmentNames = [];
  if (["agent", "doctorStaff", "staff"].includes(user.role)) {
    const userId = user._id || user.userId || user.id;
    const deptRecords = await DoctorDepartment.find({ doctorId: userId }).select("name").lean();
    agentDepartmentNames = deptRecords.map(d => d.name).filter(Boolean);
  }

  const { type } = req.query;

  if (type === "sops") {
    // For agent/doctorStaff/staff, show SOPs whose department matches the agent's assigned departments
    let sopFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      if (agentDepartmentNames.length > 0) {
        sopFilter = { clinicId, department: { $in: agentDepartmentNames } };
      } else {
        // Agent has no departments assigned – show nothing
        return res.status(200).json({ success: true, items: [] });
      }
    }
    const items = await SOP.find(sopFilter).sort({ updatedAt: -1 }).lean();
    const agentsTotal = await User.countDocuments({ clinicId, role: "agent" });
    const doctorsTotal = await User.countDocuments({ clinicId, role: "doctorStaff" });
    const ids = items.map(i => i._id);
    const acks = await Acknowledgment.aggregate([
      { $match: { clinicId, documentType: "SOP", status: "Acknowledged", documentId: { $in: ids } } },
      { $group: { _id: { doc: "$documentId", role: "$role" }, count: { $sum: 1 } } }
    ]);
    const ackAgent = {};
    const ackDoctor = {};
    for (const r of acks) {
      const idStr = r._id.doc.toString();
      if (r._id.role === "agent") ackAgent[idStr] = r.count;
      if (r._id.role === "doctorStaff") ackDoctor[idStr] = r.count;
    }
    const normalizeRoles = (rolesArr = []) => {
      const lower = (rolesArr || []).map(r => String(r).toLowerCase());
      const hasAll = lower.some(r => r.includes("all"));
      const set = new Set();
      if (hasAll) { set.add("agent"); set.add("doctorStaff"); return set; }
      for (const r of lower) {
        if (r.includes("agent")) set.add("agent");
        if (r.includes("doctor")) set.add("doctorStaff");
      }
      return set;
    };
    const withPercents = items.map(i => {
      const idStr = i._id.toString();
      const applicable = normalizeRoles(i.applicableRoles || []);
      const pa = applicable.has("agent") && agentsTotal > 0 ? ((ackAgent[idStr] || 0) / agentsTotal) * 100 : 0;
      const pd = applicable.has("doctorStaff") && doctorsTotal > 0 ? ((ackDoctor[idStr] || 0) / doctorsTotal) * 100 : 0;
      const denom =
        (applicable.has("agent") ? agentsTotal : 0) +
        (applicable.has("doctorStaff") ? doctorsTotal : 0);
      const ackCount = (ackAgent[idStr] || 0) + (ackDoctor[idStr] || 0);
      const overall = denom > 0 ? (ackCount / denom) * 100 : (pa || pd);
      return { ...i, ackPercentAgent: pa, ackPercentDoctor: pd, ackOverall: overall };
    });
    return res.status(200).json({ success: true, items: withPercents });
  }
  if (type === "policies") {
    // For agent/doctorStaff/staff, show Policies whose department matches the agent's assigned departments
    let policyFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      if (agentDepartmentNames.length > 0) {
        policyFilter = { clinicId, department: { $in: agentDepartmentNames } };
      } else {
        return res.status(200).json({ success: true, items: [] });
      }
    }
    const items = await Policy.find(policyFilter).sort({ updatedAt: -1 }).lean();
    const agentsTotal = await User.countDocuments({ clinicId, role: "agent" });
    const doctorsTotal = await User.countDocuments({ clinicId, role: "doctorStaff" });
    const ids = items.map(i => i._id);
    const acks = await Acknowledgment.aggregate([
      { $match: { clinicId, documentType: "Policy", status: "Acknowledged", documentId: { $in: ids } } },
      { $group: { _id: { doc: "$documentId", role: "$role" }, count: { $sum: 1 } } }
    ]);
    const ackAgent = {};
    const ackDoctor = {};
    for (const r of acks) {
      const idStr = r._id.doc.toString();
      if (r._id.role === "agent") ackAgent[idStr] = r.count;
      if (r._id.role === "doctorStaff") ackDoctor[idStr] = r.count;
    }
    const inferFromAppliesTo = (appliesTo) => {
      const txt = String(appliesTo || "").toLowerCase();
      const set = new Set();
      if (txt.includes("all")) { set.add("agent"); set.add("doctorStaff"); }
      if (txt.includes("agent")) set.add("agent");
      if (txt.includes("doctor")) set.add("doctorStaff");
      return set;
    };
    const withPercents = items.map(i => {
      const idStr = i._id.toString();
      const applicable = new Set((i.appliesToRoles || []).length ? i.appliesToRoles : Array.from(inferFromAppliesTo(i.appliesTo)));
      const pa = applicable.has("agent") && agentsTotal > 0 ? ((ackAgent[idStr] || 0) / agentsTotal) * 100 : 0;
      const pd = applicable.has("doctorStaff") && doctorsTotal > 0 ? ((ackDoctor[idStr] || 0) / doctorsTotal) * 100 : 0;
      const denom =
        (applicable.has("agent") ? agentsTotal : 0) +
        (applicable.has("doctorStaff") ? doctorsTotal : 0);
      const ackCount = (ackAgent[idStr] || 0) + (ackDoctor[idStr] || 0);
      const overall = denom > 0 ? (ackCount / denom) * 100 : (pa || pd);
      return { ...i, ackPercentAgent: pa, ackPercentDoctor: pd, ackOverall: overall };
    });
    return res.status(200).json({ success: true, items: withPercents });
  }
  if (type === "playbooks") {
    // For agent/doctorStaff/staff, show Playbooks whose department matches the agent's assigned departments
    let playbookFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      if (agentDepartmentNames.length > 0) {
        playbookFilter = { clinicId, department: { $in: agentDepartmentNames } };
      } else {
        return res.status(200).json({ success: true, items: [] });
      }
    }
    const items = await Playbook.find(playbookFilter).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, items });
  }

  // For overview counts, filter based on role
  let sopQuery = { clinicId };
  let policyQuery = { clinicId };
  let playbookQuery = { clinicId };
  if (["agent", "doctorStaff", "staff"].includes(user.role)) {
    if (agentDepartmentNames.length > 0) {
      sopQuery = { clinicId, department: { $in: agentDepartmentNames } };
      policyQuery = { clinicId, department: { $in: agentDepartmentNames } };
      playbookQuery = { clinicId, department: { $in: agentDepartmentNames } };
    } else {
      // Agent has no departments assigned – show zero counts
      return res.status(200).json({
        success: true,
        overview: { sopCount: 0, policyCount: 0, playbookCount: 0 },
      });
    }
  }
  const sopCount = await SOP.countDocuments(sopQuery);
  const policyCount = await Policy.countDocuments(policyQuery);
  const playbookCount = await Playbook.countDocuments(playbookQuery);

  return res.status(200).json({
    success: true,
    overview: {
      sopCount,
      policyCount,
      playbookCount,
    },
  });
}
