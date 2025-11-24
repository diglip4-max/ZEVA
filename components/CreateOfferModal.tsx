import { useState, useEffect } from "react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return alert("Clinic ID not loaded yet.");

    // Check permissions before submitting
    if (mode === "create" && !permissions.canCreate) {
      alert("You do not have permission to create offers");
      return;
    }
    if (mode === "update" && !permissions.canUpdate) {
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
      if (data.success) {
        onCreated(data.offer);
        onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === "create" ? "Create New Offer" : "Update Offer"}
            </h2>
            <p className="text-teal-50 text-xs mt-0.5">
              {mode === "create" 
                ? "Fill in the details to create a promotional offer" 
                : !offer ? "Loading offer..." : "Modify the offer details below"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Basic Information</h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Offer Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  placeholder="e.g., Summer Special Discount"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none text-sm"
                  placeholder="Describe the offer details..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    required
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free Consult">Free Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {form.type === "percentage" ? "Discount (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    name="value"
                    value={form.value}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Schedule & Limits</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    name="startsAt"
                    value={form.startsAt}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">End Date & Time</label>
                  <input
                    type="datetime-local"
                    name="endsAt"
                    value={form.endsAt}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Maximum Total Uses</label>
                  <input
                    type="number"
                    name="maxUses"
                    value={form.maxUses || ""}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Uses Per User</label>
                  <input
                    type="number"
                    name="perUserLimit"
                    value={form.perUserLimit}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            {/* Distribution Channels */}
            <div className="space-y-3.5">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Distribution Channels</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["email", "sms", "web", "affiliate"].map((c) => (
                  <label key={c} className="flex items-center space-x-2.5 p-2.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="channels"
                      value={c}
                      checked={form.channels.includes(c)}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-xs font-medium text-gray-700 capitalize">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* UTM Parameters */}
            <div className="space-y-3.5">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Tracking (UTM Parameters)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">UTM Source</label>
                  <input
                    type="text"
                    name="utm.source"
                    value={form.utm.source}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="clinic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">UTM Medium</label>
                  <input
                    type="text"
                    name="utm.medium"
                    value={form.utm.medium}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">UTM Campaign</label>
                  <input
                    type="text"
                    name="utm.campaign"
                    value={form.utm.campaign}
                    onChange={handleChange}
                    className="text-gray-700 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="summer-2024"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3.5">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Status</h3>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="text-gray-700 w-full md:w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
              >
                {["draft", "active", "paused", "expired", "archived"].map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Treatments Selection */}
            <div className="space-y-3.5">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Applicable Treatments</h3>
              <div className="border border-gray-200 rounded-md p-3 bg-gray-50 max-h-64 overflow-y-auto">
                {treatments.length === 0 ? (
                  <p className="text-gray-500 text-center py-3 text-sm">No treatments available</p>
                ) : (
                  <div className="space-y-3">
                    {treatments.map((t: any, i: number) => (
                      <div key={i} className="bg-white rounded-md p-3 shadow-sm">
                        <label className="flex items-center space-x-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.treatments.includes(t.mainTreatmentSlug)}
                            onChange={(e) =>
                              toggleTreatment(t.mainTreatmentSlug, e.target.checked)
                            }
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                          />
                          <span className="font-medium text-gray-800 text-sm">{t.mainTreatment}</span>
                        </label>
                        {t.subTreatments?.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1.5">
                            {t.subTreatments.map((sub: any, j: number) => (
                              <label key={j} className="flex items-center space-x-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.treatments.includes(sub.slug)}
                                  onChange={(e) =>
                                    toggleTreatment(sub.slug, e.target.checked)
                                  }
                                  className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                                />
                                <span className="text-xs text-gray-600">
                                  {sub.name} <span className="text-gray-400">— ₹{sub.price ?? 0}</span>
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

          {/* Footer Actions */}
          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === "create" && !permissions.canCreate) || (mode === "update" && !permissions.canUpdate)}
              className="px-5 py-2 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
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
    </div>
  );
}
