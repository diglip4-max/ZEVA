"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle, Loader2, AlertCircle, Plus, Trash2, X } from "lucide-react";

const MessageBanner = ({ type = "success", text }) => {
  if (!text) return null;

  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };

  const Icon = type === "error" ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles[type]}`}>
      <Icon className="w-5 h-5" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
};

const DoctorTreatmentModal = ({ isOpen, onClose, doctorStaffId, doctorStaffName, token }) => {
  const [baseTreatments, setBaseTreatments] = useState([]);
  const [doctorTreatments, setDoctorTreatments] = useState([]);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState("");
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [price, setPrice] = useState("");
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "info", text: "" });
  const [activeTab, setActiveTab] = useState("existing"); // "existing" or "custom"
  const [customTreatmentName, setCustomTreatmentName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customSubTreatments, setCustomSubTreatments] = useState([
    { id: Date.now(), name: "", price: "" },
  ]);
  const [customSubmitting, setCustomSubmitting] = useState(false);

  const selectedTreatment = useMemo(
    () => baseTreatments.find((t) => t._id === selectedTreatmentId),
    [baseTreatments, selectedTreatmentId]
  );

  const getAuthHeaders = () => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const loadBaseTreatments = async () => {
    try {
      const res = await axios.get("/api/staff/available-treatments", {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setBaseTreatments(res.data.treatments || []);
      } else {
        setMessage({ type: "error", text: res.data.message || "Unable to load treatments" });
      }
    } catch (error) {
      console.error("Error loading treatments", error);
      setMessage({ type: "error", text: "Unable to load treatments" });
    }
  };

  const loadDoctorTreatments = async () => {
    if (!doctorStaffId) return;
    try {
      const res = await axios.get(`/api/clinic/doctor-treatments?doctorStaffId=${doctorStaffId}`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setDoctorTreatments(res.data.treatments || []);
      } else {
        setMessage({ type: "error", text: res.data.message || "Unable to load treatments" });
      }
    } catch (error) {
      console.error("Error loading doctor treatments", error);
      setMessage({ type: "error", text: "Unable to load treatments" });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isOpen && doctorStaffId) {
      setFetching(true);
      setMessage({ type: "info", text: "" });
      Promise.all([loadBaseTreatments(), loadDoctorTreatments()]).finally(() => setFetching(false));
    }
  }, [isOpen, doctorStaffId]);

  const toggleSubcategory = (slug) => {
    setSelectedSubcategories((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  };

  const resetForm = () => {
    setSelectedTreatmentId("");
    setSelectedSubcategories([]);
    setPrice("");
  };

  const resetCustomForm = () => {
    setCustomTreatmentName("");
    setCustomPrice("");
    setCustomSubTreatments([{ id: Date.now(), name: "", price: "" }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTreatmentId) {
      setMessage({ type: "error", text: "Select a treatment first" });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "info", text: "" });

    try {
      const payload = {
        doctorStaffId,
        treatmentId: selectedTreatmentId,
        subcategoryIds: selectedSubcategories,
        price: price === "" ? null : price,
      };

      const res = await axios.post("/api/clinic/doctor-treatments", payload, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setDoctorTreatments(res.data.treatments || []);
        setMessage({ type: "success", text: res.data.message || "Treatment assigned successfully" });
        resetForm();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to assign treatment" });
      }
    } catch (error) {
      console.error("Error assigning treatment", error);
      const errorMessage = error.response?.data?.message || "Failed to assign treatment";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCustomTreatment = async (e) => {
    e.preventDefault();

    if (!customTreatmentName.trim()) {
      setMessage({ type: "error", text: "Please enter a treatment name" });
      return;
    }

    const preparedSubTreatments = customSubTreatments
      .filter((sub) => sub.name && sub.name.trim())
      .map((sub) => ({
        name: sub.name.trim(),
        price: sub.price === "" ? null : Number(sub.price),
      }));

    const hasInvalidSubPrice = preparedSubTreatments.some(
      (sub) => sub.price !== null && Number.isNaN(sub.price)
    );
    if (hasInvalidSubPrice) {
      setMessage({ type: "error", text: "Sub treatment price must be a number" });
      return;
    }

    const parsedCustomPrice = customPrice === "" ? null : Number(customPrice);
    if (parsedCustomPrice !== null && Number.isNaN(parsedCustomPrice)) {
      setMessage({ type: "error", text: "Custom price must be a number" });
      return;
    }

    setCustomSubmitting(true);
    setMessage({ type: "info", text: "" });

    try {
      const payload = {
        doctorStaffId,
        treatmentName: customTreatmentName.trim(),
        price: parsedCustomPrice,
        subTreatments: preparedSubTreatments,
      };

      const res = await axios.post("/api/clinic/doctor-treatments", payload, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setDoctorTreatments(res.data.treatments || []);
        setMessage({ type: "success", text: res.data.message || "Custom treatment created" });
        resetCustomForm();
        loadBaseTreatments();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to create treatment" });
      }
    } catch (error) {
      console.error("Error creating custom treatment", error);
      const errorMessage = error.response?.data?.message || "Failed to create treatment";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setCustomSubmitting(false);
    }
  };

  const addSubTreatmentRow = () => {
    setCustomSubTreatments([...customSubTreatments, { id: Date.now(), name: "", price: "" }]);
  };

  const removeSubTreatmentRow = (id) => {
    setCustomSubTreatments(customSubTreatments.filter((sub) => sub.id !== id));
  };

  const updateSubTreatment = (id, field, value) => {
    setCustomSubTreatments(
      customSubTreatments.map((sub) => (sub.id === id ? { ...sub, [field]: value } : sub))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manage Treatments</h2>
            <p className="text-sm text-gray-500 mt-1">For: {doctorStaffName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <MessageBanner type={message.type} text={message.text} />

          {/* Tabs */}
          <div className="flex space-x-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("existing")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "existing"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Assign Existing Treatment
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "custom"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create Custom Treatment
            </button>
          </div>

          {/* Existing Treatments Tab */}
          {activeTab === "existing" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Treatment</label>
                <select
                  value={selectedTreatmentId}
                  onChange={(e) => {
                    setSelectedTreatmentId(e.target.value);
                    setSelectedSubcategories([]);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a treatment</option>
                  {baseTreatments.map((treatment) => (
                    <option key={treatment._id} value={treatment._id}>
                      {treatment.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTreatment?.subcategories?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Sub Treatments (optional)
                    </label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() =>
                        setSelectedSubcategories(
                          selectedTreatment.subcategories.map((sub) => sub.slug || sub.name)
                        )
                      }
                    >
                      Select all
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedTreatment.subcategories.map((sub) => {
                      const value = sub.slug || sub.name;
                      return (
                        <label
                          key={value}
                          className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                            selectedSubcategories.includes(value)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600"
                            checked={selectedSubcategories.includes(value)}
                            onChange={() => toggleSubcategory(value)}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                            {sub.price ? (
                              <p className="text-xs text-gray-500">Default ₹{sub.price}</p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom price (optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter price override"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Assigning..." : "Assign Treatment"}
              </button>
            </form>
          )}

          {/* Custom Treatment Tab */}
          {activeTab === "custom" && (
            <form onSubmit={handleCreateCustomTreatment} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Treatment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customTreatmentName}
                  onChange={(e) => setCustomTreatmentName(e.target.value)}
                  placeholder="Enter treatment name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter default price"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Sub Treatments (optional)
                  </label>
                  <button
                    type="button"
                    onClick={addSubTreatmentRow}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Add Sub Treatment
                  </button>
                </div>
                <div className="space-y-3">
                  {customSubTreatments.map((sub) => (
                    <div key={sub.id} className="flex gap-3 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateSubTreatment(sub.id, "name", e.target.value)}
                          placeholder="Sub treatment name"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-500 text-xs">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sub.price}
                            onChange={(e) => updateSubTreatment(sub.id, "price", e.target.value)}
                            placeholder="Price"
                            className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      {customSubTreatments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubTreatmentRow(sub.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={customSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {customSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {customSubmitting ? "Creating..." : "Create & Assign Treatment"}
              </button>
            </form>
          )}

          {/* Existing Treatments List */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Treatments</h3>
            {fetching ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading treatments...
              </div>
            ) : doctorTreatments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No treatments assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {doctorTreatments.map((item) => (
                  <div
                    key={item._id}
                    className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{item.treatmentName}</h4>
                        {item.price && (
                          <p className="text-sm text-gray-600 font-medium">
                            Custom Treatment Price: ₹{item.price}
                          </p>
                        )}
                        {!item.price && (
                          <p className="text-sm text-gray-500">Using default clinic pricing</p>
                        )}
                      </div>
                    </div>
                    {item.subcategories && item.subcategories.length > 0 && (
                      <div className="mt-2 border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">Sub Treatments:</p>
                        <div className="space-y-2">
                          {item.subcategories.map((sub, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                            >
                              <span className="text-sm text-gray-900 font-medium">{sub.name}</span>
                              {sub.price !== null && sub.price !== undefined ? (
                                <span className="text-sm font-semibold text-blue-600">
                                  ₹{sub.price}
                                </span>
                              ) : item.price ? (
                                <span className="text-sm text-gray-500">Uses treatment price</span>
                              ) : (
                                <span className="text-sm text-gray-500">Default pricing</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!item.subcategories || item.subcategories.length === 0) && (
                      <p className="text-xs text-gray-500 italic">No sub-treatments selected</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorTreatmentModal;

