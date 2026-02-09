import React, { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (offer: any) => void;
  token: string;
  mode?: "create" | "update";
  offer?: any;
  actorRole?: "clinic" | "doctor" | "agent" | "admin";
}

export default function CreateOfferModal({
  isOpen,
  onClose,
  onCreated,
  token,
  mode = "create",
  offer,
  actorRole = "clinic",
}: Props) {
  const isUpdate = mode === "update";
  const headerClass = isUpdate ? "bg-teal-800" : "bg-gray-800";
  const subtitleClass = isUpdate ? "text-teal-100" : "text-gray-300";
  const formBgClass = isUpdate ? "bg-teal-50" : "";
  const footerBgClass = isUpdate ? "border-t bg-teal-50" : "border-t bg-gray-50";
  const cancelBtnVariant = isUpdate
    ? "border-teal-600 text-teal-700 hover:bg-teal-100"
    : "border-gray-200 text-gray-700 hover:bg-gray-100";
  const submitBtnVariant = isUpdate
    ? "bg-teal-700 hover:bg-teal-800"
    : "bg-gray-800 hover:bg-gray-900";
  const getInitialForm = () => ({
    title: "",
    description: "",
    type: "percentage",
    value: 0,
    currency: "INR",
    code: "",
    slug: "",
    startsAt: "",
    endsAt: "",
    timezone: "Asia/Kolkata",
    maxUses: null as number | null,
    usesCount: 0,
    perUserLimit: 1,
    channels: [] as string[],
    utm: { source: actorRole, medium: "email", campaign: "" },
    conditions: {} as Record<string, any>,
    status: "draft",
    treatments: [] as string[],
  });
  const [form, setForm] = useState(getInitialForm);

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<{
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canRead: boolean;
  }>({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
  });
  const [resolvedToken, setResolvedToken] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const resolveTokenFromContext = () => {
    if (token) return token;
    if (typeof window === "undefined") return "";

    const roleFallbackMap: Record<string, string[]> = {
      clinic: ["clinicToken"],
      doctor: ["doctorToken", "clinicToken"],
      agent: ["agentToken", "clinicToken"],
      admin: ["adminToken"],
    };

    const fallbackKeys = [
      ...(roleFallbackMap[actorRole] || []),
      "clinicToken",
      "doctorToken",
      "agentToken",
      "adminToken",
    ];

    const seen = new Set<string>();
    for (const key of fallbackKeys) {
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const value =
          window.localStorage?.getItem(key) ||
          window.sessionStorage?.getItem(key);
        if (value) return value;
      } catch {
        // ignore access issues
      }
    }
    return "";
  };

  useEffect(() => {
    if (!isOpen && !token) {
      setResolvedToken("");
      return;
    }
    const nextToken = resolveTokenFromContext();
    setResolvedToken(nextToken);
  }, [isOpen, token, actorRole]);

  useEffect(() => {
    if (!isOpen) return;

    const authToken = resolvedToken;
    if (!authToken) {
      setClinicId(null);
      setTreatments([]);
      setPermissions({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canRead: false,
      });
      return;
    }

    const fetchClinicData = async () => {
      try {
        // Fetch clinic data and permissions in parallel
        const [clinicRes, permissionsRes] = await Promise.all([
          fetch("/api/lead-ms/get-clinic-treatment", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/clinic/permissions", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        const clinicData = await clinicRes.json();
        if (clinicData.success) {
          setClinicId(clinicData.clinicId);
          setTreatments(clinicData.treatments || []);
        }

        // Process permissions
        const permissionsData = await permissionsRes.json();
        if (permissionsData.success && permissionsData.data) {
          const modulePermission = permissionsData.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            if (p.module === "create_offers") return true;
            if (p.module === "clinic_create_offers") return true;
            if (p.module.startsWith("clinic_") && p.module.slice(7) === "create_offers") {
              return true;
            }
            return false;
          });

          if (modulePermission) {
            const actions = modulePermission.actions || {};
            setPermissions({
              canCreate: actions.all === true || actions.create === true,
              canUpdate: actions.all === true || actions.update === true,
              canDelete: actions.all === true || actions.delete === true,
              canRead: actions.all === true || actions.read === true,
            });
          } else {
            // If no permissions found, default to no access
            setPermissions({
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              canRead: false,
            });
          }
        } else {
          // If permissions API fails, default to no access for safety
          console.warn("Could not fetch permissions, defaulting to no access");
          setPermissions({
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canRead: false,
          });
        }
      } catch (err) {
        console.error("Error fetching clinic data", err);
        // On error, default to no access for safety
        setPermissions({
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          canRead: false,
        });
      }
    };

    fetchClinicData();
  }, [isOpen, resolvedToken]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "create") {
      setForm(getInitialForm());
      setErrors({});
      setShowSuccessPopup(false);
      return;
    }

    // Fast path: use the already-fetched offer from the parent to avoid an extra network call
    if (mode === "update") {
      if (!offer) return; // parent is still fetching; show loading state in UI

      const selectedSlugs = [
        ...(offer.treatments?.map((t: any) => t.mainTreatmentSlug) || []),
        ...(offer.treatments?.flatMap(
          (t: any) => t.subTreatments?.map((st: any) => st.slug) || []
        ) || []),
      ];

      setForm({
        title: offer.title || "",
        description: offer.description || "",
        type: offer.type || "percentage",
        value: offer.value || 0,
        currency: offer.currency || "INR",
        code: offer.code || "",
        slug: offer.slug || "",
        startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString().slice(0, 16) : "",
        endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString().slice(0, 16) : "",
        timezone: offer.timezone || "Asia/Kolkata",
        maxUses: offer.maxUses || null,
        usesCount: offer.usesCount || 0,
        perUserLimit: offer.perUserLimit || 1,
        channels: offer.channels || [],
        utm: offer.utm || { source: actorRole, medium: "email", campaign: "" },
        conditions: offer.conditions || {},
        status: offer.status || "draft",
        treatments: selectedSlugs,
      });
      setClinicId(offer.clinicId || null);
    }
  }, [isOpen, mode, offer, actorRole]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const name = (target as HTMLInputElement).name;
    const value = (target as HTMLInputElement).value;
    const type = (target as HTMLInputElement).type as string;
    const checked = (target as HTMLInputElement).checked as boolean;

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
    if (errors[name.split(".")[0]]) {
      const baseKey = name.split(".")[0];
      setErrors({ ...errors, [baseKey]: "" });
    }

    if (["value", "perUserLimit", "maxUses"].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: value ? Number(value) : null }));
      return;
    }

    if (type === "checkbox" && name === "channels") {
      setForm((prev) => ({
        ...prev,
        channels: checked
          ? [...prev.channels, value]
          : prev.channels.filter((c) => c !== value),
      }));
      return;
    }

    if (name.startsWith("utm.")) {
      const key = name.split(".")[1];
      setForm((prev) => ({ ...prev, utm: { ...prev.utm, [key]: value } }));
      return;
    }

    if (name.startsWith("conditions.")) {
      const key = name.split(".")[1];
      setForm((prev) => ({
        ...prev,
        conditions: { ...prev.conditions, [key]: value },
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTreatment = (slug: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      treatments: checked
        ? [...prev.treatments, slug]
        : prev.treatments.filter((s) => s !== slug),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Title validation
    if (!form.title || form.title.trim().length === 0) {
      newErrors.title = "Offer title is required";
    } else if (form.title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }

    // Value validation
    if (form.type !== "free Consult") {
      if (!form.value || form.value <= 0) {
        newErrors.value = "Value must be greater than 0";
      }
      if (form.type === "percentage" && form.value > 100) {
        newErrors.value = "Percentage cannot exceed 100%";
      }
    }

    // Start date validation
    if (!form.startsAt || form.startsAt.trim().length === 0) {
      newErrors.startsAt = "Start date is required";
    }

    // End date validation
    if (!form.endsAt || form.endsAt.trim().length === 0) {
      newErrors.endsAt = "End date is required";
    }

    // Date comparison validation
    if (form.startsAt && form.endsAt) {
      const startDate = new Date(form.startsAt);
      const endDate = new Date(form.endsAt);
      if (endDate <= startDate) {
        newErrors.endsAt = "End date must be after start date";
      }
    }

    // Max uses validation
    if (form.maxUses !== null && form.maxUses !== undefined && form.maxUses < 1) {
      newErrors.maxUses = "Maximum uses must be at least 1";
    }

    // Per user limit validation
    if (!form.perUserLimit || form.perUserLimit < 1) {
      newErrors.perUserLimit = "Uses per user must be at least 1";
    }

    // UTM Source validation (if provided, must be valid)
    if (form.utm.source && form.utm.source.trim().length > 0) {
      if (form.utm.source.trim().length < 2) {
        newErrors["utm.source"] = "UTM source must be at least 2 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    if (!clinicId) {
      setErrors({ ...errors, clinic: "Clinic ID not loaded yet." });
      return;
    }

    // ✅ Strict permission checks before submitting
    if (mode === "create" && permissions.canCreate !== true) {
      alert("You do not have permission to create offers");
      return;
    }
    if (mode === "update" && permissions.canUpdate !== true) {
      alert("You do not have permission to update offers");
      return;
    }

    setLoading(true);
    try {
      const authToken = resolvedToken || resolveTokenFromContext();
      if (!authToken) {
        alert("Authentication token missing. Please log in again.");
        setLoading(false);
        return;
      }

      const url =
        mode === "create"
          ? "/api/lead-ms/create-offer"
          : `/api/lead-ms/update-offer?id=${offer._id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...form,
          clinicId,
          startsAt: form.startsAt ? new Date(form.startsAt) : null,
          endsAt: form.endsAt ? new Date(form.endsAt) : null,
        }),
      });

      const data = await res.json();
      
      // ✅ Handle 403 permission denied explicitly
      if (res.status === 403 || (data.message && data.message.toLowerCase().includes("permission"))) {
        alert(data.message || `You do not have permission to ${mode} offers`);
        setLoading(false);
        return;
      }
      
      if (data.success) {
        onCreated(data.offer);
        setShowSuccessPopup(true);
        // Close modal after 2 seconds
        setTimeout(() => {
          setShowSuccessPopup(false);
          onClose();
          setErrors({});
        }, 2000);
      } else {
        alert(data.message || `Failed to ${mode} offer`);
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Compact Header */}
        <div className={`${headerClass} px-4 py-3 flex justify-between items-center`}>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {mode === "create" ? "Create New Offer" : "Update Offer"}
            </h2>
            <p className={`${subtitleClass} text-[10px] sm:text-xs mt-0.5`}>
              {mode === "create" 
                ? "Fill in the details to create a promotional offer" 
                : !offer ? "Loading offer..." : "Modify the offer details below"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Compact Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className={`${formBgClass} px-4 py-3 space-y-4`}>
            {/* Basic Information Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Basic Information</h3>
              
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Offer Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                    errors.title ? "border-red-500" : "border-gray-200"
                  }`}
                  placeholder="e.g., Summer Special Discount"
                  required
                />
                {errors.title && (
                  <p className="text-red-500 text-[10px] mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all resize-none text-xs sm:text-sm"
                  placeholder="Describe the offer details..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm"
                    required
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free Consult">Free Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                    {form.type === "percentage" ? "Discount (%)" : `Amount (د.إ)`}
                  </label>
                  <input
                    type="number"
                    name="value"
                    value={form.value}
                    onChange={handleChange}
                    min="0"
                    step={form.type === "percentage" ? "1" : "0.01"}
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors.value ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="0"
                  />
                  {errors.value && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.value}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Schedule Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Schedule & Limits</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    name="startsAt"
                    value={form.startsAt}
                    onChange={handleChange}
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors.startsAt ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  {errors.startsAt && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.startsAt}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    name="endsAt"
                    value={form.endsAt}
                    onChange={handleChange}
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors.endsAt ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  {errors.endsAt && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.endsAt}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">Maximum Total Uses</label>
                  <input
                    type="number"
                    name="maxUses"
                    value={form.maxUses || ""}
                    onChange={handleChange}
                    min="1"
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors.maxUses ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="Unlimited"
                  />
                  {errors.maxUses && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.maxUses}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">Uses Per User</label>
                  <input
                    type="number"
                    name="perUserLimit"
                    value={form.perUserLimit}
                    onChange={handleChange}
                    min="1"
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors.perUserLimit ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="1"
                  />
                  {errors.perUserLimit && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.perUserLimit}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Distribution Channels */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Distribution Channels</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["email", "sms", "web", "affiliate"].map((c) => (
                  <label key={c} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="channels"
                      value={c}
                      checked={form.channels.includes(c)}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 text-gray-800 rounded focus:ring-gray-800"
                    />
                    <span className="text-[10px] sm:text-xs font-medium text-gray-700 capitalize">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Compact UTM Parameters */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Tracking (UTM Parameters)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">UTM Source</label>
                  <input
                    type="text"
                    name="utm.source"
                    value={form.utm.source}
                    onChange={handleChange}
                    className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm ${
                      errors["utm.source"] ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="clinic"
                  />
                  {errors["utm.source"] && (
                    <p className="text-red-500 text-[10px] mt-1">{errors["utm.source"]}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">UTM Medium</label>
                  <input
                    type="text"
                    name="utm.medium"
                    value={form.utm.medium}
                    onChange={handleChange}
                    className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm"
                    placeholder="email"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">UTM Campaign</label>
                  <input
                    type="text"
                    name="utm.campaign"
                    value={form.utm.campaign}
                    onChange={handleChange}
                    className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm"
                    placeholder="summer-2024"
                  />
                </div>
              </div>
            </div>

            {/* Compact Status */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Status</h3>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="text-gray-900 w-full md:w-1/2 border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all text-xs sm:text-sm"
              >
                {["draft", "active", "paused", "expired", "archived"].map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Treatments Selection */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">Applicable Treatments</h3>
              <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50 max-h-56 overflow-y-auto">
                {treatments.length === 0 ? (
                  <p className="text-gray-500 text-center py-2 text-xs sm:text-sm">No treatments available</p>
                ) : (
                  <div className="space-y-2">
                    {treatments.map((t: any, i: number) => (
                      <div key={i} className="bg-white rounded-lg p-2.5 shadow-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.treatments.includes(t.mainTreatmentSlug)}
                            onChange={(e) =>
                              toggleTreatment(t.mainTreatmentSlug, e.target.checked)
                            }
                            className="w-3.5 h-3.5 text-gray-800 rounded focus:ring-gray-800"
                          />
                          <span className="font-medium text-gray-900 text-xs sm:text-sm">{t.mainTreatment}</span>
                        </label>
                        {t.subTreatments?.length > 0 && (
                          <div className="ml-5 mt-1.5 space-y-1">
                            {t.subTreatments.map((sub: any, j: number) => (
                              <label key={j} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.treatments.includes(sub.slug)}
                                  onChange={(e) =>
                                    toggleTreatment(sub.slug, e.target.checked)
                                  }
                                  className="w-3 h-3 text-gray-800 rounded focus:ring-gray-800"
                                />
                                <span className="text-[10px] sm:text-xs text-gray-600">
                                  {sub.name} <span className="text-gray-400">— د.إ{sub.price ?? 0}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compact Footer Actions */}
          <div className={`${footerBgClass} px-4 py-3 flex justify-end gap-2`}>
            <button
              type="button"
              onClick={onClose}
              className={["px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors", cancelBtnVariant].join(" ")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === "create" && !permissions.canCreate) || (mode === "update" && !permissions.canUpdate)}
              className={["px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm", submitBtnVariant].join(" ")}
              title={
                mode === "create" && !permissions.canCreate
                  ? "You do not have permission to create offers"
                  : mode === "update" && !permissions.canUpdate
                  ? "You do not have permission to update offers"
                  : ""
              }
            >
              {loading
                ? "Saving..."
                : mode === "create"
                ? "Create Offer"
                : "Update Offer"}
            </button>
          </div>
        </form>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 transform transition-all">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Offer Submitted!</h3>
              <p className="text-sm text-gray-600">
                Your offer has been {mode === "create" ? "created" : "updated"} successfully.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
