import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { Setting } from "../../../models/settings/Setting";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { notificationData } from "../../../lib/notifications/index";

export default async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("DB connect error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only clinic staff can manage notification settings.",
    });
  }

  // Resolve clinicId
  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) return res.status(400).json({ success: false, message: "Clinic not found" });
    clinicId = clinic._id;
  } else if (me.role === "admin") {
    clinicId = req.query.clinicId || req.body?.clinicId;
    if (!clinicId) return res.status(400).json({ success: false, message: "clinicId required for admin" });
  } else {
    if (!me.clinicId) return res.status(400).json({ success: false, message: "Not tied to a clinic" });
    clinicId = me.clinicId;
  }

  // -----------------------------------------------
  // GET /api/settings — list notification settings
  // -----------------------------------------------
  if (req.method === "GET") {
    try {
      const {
        category,
        search,
        isEnabled,
        isProtected,
        page = 1,
        limit = 20,
      } = req.query;

      // Upsert: seed settings doc if clinic doesn't have one yet
      let settingDoc = await Setting.findOne({ clinicId });
      if (!settingDoc) {
        settingDoc = await Setting.create({
          clinicId,
          notificationSetting: notificationData.map((n) => ({
            notificationTypeKey: n.notificationTypeKey,
            category: n.category,
            label: n.label,
            isEnabled: n.isEnabled,
            isProtected: n.isProtected,
            trigger: { event: n.trigger.event, conditions: n.trigger.conditions || {} },
            channels: n.channels.map((ch) => ({
              channel: ch.channel,
              recipient: ch.recipient,
              isEnabled: ch.isEnabled,
              priority: ch.priority,
            })),
            timing: { mode: n.timing.mode, offsetMinutes: n.timing.offsetMinutes },
            bypassQuietHours: n.bypassQuietHours,
            respectMarketingPreference: n.respectMarketingPreference,
            preventDuplicateForSameEvent: n.preventDuplicateForSameEvent,
          })),
        });
      }

      // Filter on notificationSetting subdocs
      let settings = settingDoc.notificationSetting || [];

      if (category && category !== "all") {
        settings = settings.filter((s) => s.category === category);
      }
      if (isEnabled !== undefined && isEnabled !== "") {
        const enabled = isEnabled === "true";
        settings = settings.filter((s) => s.isEnabled === enabled);
      }
      if (isProtected !== undefined && isProtected !== "") {
        const prot = isProtected === "true";
        settings = settings.filter((s) => s.isProtected === prot);
      }
      if (search) {
        const q = search.toLowerCase();
        settings = settings.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            (s.trigger?.event || "").toLowerCase().includes(q)
        );
      }

      const total = settings.length;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const paginated = settings.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      // Analytics over ALL settings (not filtered)
      const all = settingDoc.notificationSetting || [];
      const totalCount = all.length;
      const enabledCount = all.filter((s) => s.isEnabled).length;
      const disabledCount = totalCount - enabledCount;
      const protectedCount = all.filter((s) => s.isProtected).length;

      const byCategory = {};
      for (const s of all) {
        if (!byCategory[s.category]) {
          byCategory[s.category] = { total: 0, enabled: 0 };
        }
        byCategory[s.category].total++;
        if (s.isEnabled) byCategory[s.category].enabled++;
      }

      return res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          isPaused: settingDoc.isPaused,
          quietHours: settingDoc.quietHours,
          marketingRules: settingDoc.marketingRules,
        },
        analytics: {
          total: totalCount,
          enabled: enabledCount,
          disabled: disabledCount,
          protected: protectedCount,
          byCategory,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // -----------------------------------------------
  // PATCH /api/settings — update one or global fields
  // -----------------------------------------------
  if (req.method === "PATCH") {
    try {
      const { notificationTypeKey, updates, isPaused, quietHours, marketingRules } = req.body;

      const settingDoc = await Setting.findOne({ clinicId });
      if (!settingDoc) {
        return res.status(404).json({ success: false, message: "Settings not found. Perform GET first to initialize." });
      }

      // Global pause toggle
      if (typeof isPaused === "boolean") {
        settingDoc.isPaused = isPaused;
      }

      // Quiet hours update
      if (quietHours && quietHours.start && quietHours.end) {
        settingDoc.quietHours = quietHours;
      }

      // Marketing rules update
      if (marketingRules) {
        if (typeof marketingRules.maxPerWeek === "number") {
          settingDoc.marketingRules.maxPerWeek = marketingRules.maxPerWeek;
        }
        if (Array.isArray(marketingRules.appliesToCategories)) {
          settingDoc.marketingRules.appliesToCategories = marketingRules.appliesToCategories;
        }
      }

      // Per-notification update
      if (notificationTypeKey && updates) {
        const idx = settingDoc.notificationSetting.findIndex(
          (s) => s.notificationTypeKey === notificationTypeKey
        );

        if (idx === -1) {
          return res.status(404).json({ success: false, message: `Notification type "${notificationTypeKey}" not found` });
        }

        const existing = settingDoc.notificationSetting[idx];

        if (typeof updates.isEnabled === "boolean") existing.isEnabled = updates.isEnabled;
        if (typeof updates.isProtected === "boolean") existing.isProtected = updates.isProtected;
        if (typeof updates.bypassQuietHours === "boolean") existing.bypassQuietHours = updates.bypassQuietHours;
        if (typeof updates.respectMarketingPreference === "boolean") existing.respectMarketingPreference = updates.respectMarketingPreference;
        if (typeof updates.preventDuplicateForSameEvent === "boolean") existing.preventDuplicateForSameEvent = updates.preventDuplicateForSameEvent;

        if (updates.timing) {
          if (updates.timing.mode) existing.timing.mode = updates.timing.mode;
          if (typeof updates.timing.offsetMinutes === "number") existing.timing.offsetMinutes = updates.timing.offsetMinutes;
        }

        if (Array.isArray(updates.channels)) {
          existing.channels = updates.channels;
        }

        settingDoc.notificationSetting[idx] = existing;
        settingDoc.markModified("notificationSetting");
      }

      await settingDoc.save();

      return res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: notificationTypeKey
          ? settingDoc.notificationSetting.find((s) => s.notificationTypeKey === notificationTypeKey)
          : null,
        meta: {
          isPaused: settingDoc.isPaused,
          quietHours: settingDoc.quietHours,
          marketingRules: settingDoc.marketingRules,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
