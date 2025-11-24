import { useState, useEffect } from "react";
import axios from "axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  token: string;
}

export default function CreateLeadModal({
  isOpen,
  onClose,
  onCreated,
  token,
}: Props) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    gender: "Male",
    age: "",
    treatments: [] as Array<{ treatment: string; subTreatment: string | null }>,
    source: "Instagram",
    offerTag: "",
    status: "New",
    notes: [] as Array<{ text: string }>,
    customSource: "",
    customStatus: "",
    followUps: [] as Array<{ date: Date }>,
    assignedTo: [] as string[],
  });

  const [treatments, setTreatments] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteType, setNoteType] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        // Fetch permissions, treatments, agents, and offers in parallel
        const [permissionsRes, treatmentsRes, agentsRes, offersRes] = await Promise.all([
          axios.get("/api/clinic/permissions", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/lead-ms/get-clinic-treatment", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/lead-ms/assign-lead", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/lead-ms/get-create-offer", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // Process permissions
        const permissionsData = permissionsRes.data;
        if (permissionsData.success && permissionsData.data) {
          const modulePermission = permissionsData.data.permissions?.find(
            (p: any) => p.module === "lead"
          );
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            // Check for "Create Lead" submodule
            const createLeadSubModule = modulePermission.subModules?.find(
              (sm: any) => sm.name === "Create Lead"
            );
            
            // Module-level "all" grants all permissions including submodules
            const moduleAll = actions.all === true;
            const moduleCreate = actions.create === true;
            const createLeadAll = createLeadSubModule?.actions?.all === true;
            const createLeadCreate = createLeadSubModule?.actions?.create === true;
            
            setCanCreate(moduleAll || moduleCreate || createLeadAll || createLeadCreate);
          } else {
            setCanCreate(false);
          }
        } else {
          setCanCreate(false);
        }

        setTreatments(Array.isArray(treatmentsRes.data?.treatments) ? treatmentsRes.data.treatments : []);
        setAgents(agentsRes.data?.users || []);
        const list = Array.isArray(offersRes.data?.offers) ? offersRes.data.offers : [];
        setActiveOffers(list.filter((o: any) => o.status === "active"));
      } catch (err) {
        console.error("Error fetching data:", err);
        setCanCreate(false);
      }
    };

    fetchData();
  }, [isOpen, token]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        name: "",
        phone: "",
        gender: "Male",
        age: "",
        treatments: [],
        source: "Instagram",
        offerTag: "",
        status: "New",
        notes: [],
        customSource: "",
        customStatus: "",
        followUps: [],
        assignedTo: [],
      });
      setNoteType("");
      setCustomNote("");
      setFollowUpDate("");
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTreatmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.includes("::")) {
      const [mainName, subName] = value.split("::");
      setFormData((prev) => {
        const exists = prev.treatments.some(
          (t) => t.treatment === mainName && t.subTreatment === subName
        );
        return {
          ...prev,
          treatments: exists
            ? prev.treatments.filter((t) => !(t.treatment === mainName && t.subTreatment === subName))
            : [...prev.treatments, { treatment: mainName, subTreatment: subName }],
        };
      });
      return;
    }
    const mainName = value;
    setFormData((prev) => {
      const exists = prev.treatments.some((t) => t.treatment === mainName && !t.subTreatment);
      return {
        ...prev,
        treatments: exists
          ? prev.treatments.filter((t) => !(t.treatment === mainName && !t.subTreatment))
          : [...prev.treatments, { treatment: mainName, subTreatment: null }],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permission before submitting
    if (!canCreate) {
      alert("You do not have permission to create leads");
      return;
    }

    setLoading(true);
    try {
      const selectedNote = noteType === "Custom" ? customNote.trim() : noteType;
      const notesToSend = selectedNote ? [{ text: selectedNote }] : [];
      const followUpsToSend = followUpDate
        ? [...formData.followUps, { date: followUpDate, addedBy: null }]
        : formData.followUps;

      await axios.post(
        "/api/lead-ms/create-lead",
        { ...formData, notes: notesToSend, followUps: followUpsToSend, mode: "manual" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Lead added successfully!");
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      const errorMessage = (err as any)?.response?.data?.message || "Error adding lead";
      alert(errorMessage);
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
            <h2 className="text-xl font-semibold text-white">Create New Lead</h2>
            <p className="text-teal-50 text-xs mt-0.5">Fill in the details to create a new lead</p>
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
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="Enter phone number"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="e.g. 32"
                  />
                </div>
              </div>
            </div>

            {/* Treatments */}
            <div className="space-y-3.5">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Treatments</h3>
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
                            value={t.mainTreatment}
                            checked={formData.treatments.some((tr) => tr.treatment === t.mainTreatment && !tr.subTreatment)}
                            onChange={handleTreatmentChange}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                          />
                          <span className="font-medium text-gray-800 text-sm">{t.mainTreatment}</span>
                        </label>
                        {t.subTreatments?.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1.5">
                            {t.subTreatments.map((sub: any, j: number) => {
                              const val = `${t.mainTreatment}::${sub.name}`;
                              return (
                                <label key={j} className="flex items-center space-x-2.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    value={val}
                                    checked={formData.treatments.some(tr => tr.treatment === t.mainTreatment && tr.subTreatment === sub.name)}
                                    onChange={handleTreatmentChange}
                                    className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                                  />
                                  <span className="text-xs text-gray-600">{sub.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Source and Status */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Lead Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Source</label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Google">Google</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {formData.source === "Other" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom Source</label>
                    <input
                      type="text"
                      name="customSource"
                      value={formData.customSource}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                      placeholder="Enter source"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Booked">Booked</option>
                    <option value="Visited">Visited</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {formData.status === "Other" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom Status</label>
                    <input
                      type="text"
                      name="customStatus"
                      value={formData.customStatus}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                      placeholder="Enter status"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Offer Tag</label>
                <select
                  name="offerTag"
                  value={formData.offerTag}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="">No offer</option>
                  {activeOffers.map((o) => (
                    <option key={o._id} value={o.title}>
                      {o.title} — {o.type === "percentage" ? `${o.value}%` : `₹${o.value}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes and Follow-up */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Additional Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Note</label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Select Note</option>
                    <option value="Interested">Interested</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                {noteType === "Custom" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom Note</label>
                    <input
                      type="text"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                      placeholder="Type a note"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Follow-up Date</label>
                <input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Assign To</label>
                <select
                  value={formData.assignedTo[0] || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setFormData(prev => ({ ...prev, assignedTo: selectedId ? [selectedId] : [] }));
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="">Select agent</option>
                  {agents.map(agent => (
                    <option key={agent._id} value={agent._id}>{agent.name}</option>
                  ))}
                </select>
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
              disabled={loading || !canCreate}
              className="px-5 py-2 rounded-md bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              title={!canCreate ? "You do not have permission to create leads" : ""}
            >
              {loading ? "Saving..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

