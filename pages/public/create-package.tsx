import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import axios from 'axios';
import { Package, Check, ChevronRight, Loader2 } from 'lucide-react';

interface SelectedTreatment {
  treatmentName: string;
  treatmentSlug: string;
  subcategoryName?: string;
  subcategoryIndex?: number;
  serviceId?: string;
  sessions: number;
  sessionPrice: number;
  allocatedPrice: number;
  isService?: boolean;
}

export default function CreatePackagePage() {
  const router = useRouter()
  const { clinicId, patientId, patientName, patientMobile, patientEmail } = router.query;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [services, setServices] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [selectedTreatments, setSelectedTreatments] = useState<SelectedTreatment[]>([]);
  const [packageName, setPackageName] = useState('');
  const [duration, setDuration] = useState('3'); // months

  // Patient info states - initialize from URL params
  const [patientNameInput, setPatientNameInput] = useState('');
  const [patientMobileInput, setPatientMobileInput] = useState('');
  const [patientEmailInput, setPatientEmailInput] = useState('');

  // Initialize patient info from URL on mount
  useEffect(() => {
    if (patientName) {
      setPatientNameInput(Array.isArray(patientName) ? patientName[0] : patientName);
    }
    if (patientMobile) {
      setPatientMobileInput(Array.isArray(patientMobile) ? patientMobile[0] : patientMobile);
    }
    if (patientEmail) {
      setPatientEmailInput(Array.isArray(patientEmail) ? patientEmail[0] : patientEmail);
    }
  }, [patientName, patientMobile, patientEmail]);

  useEffect(() => {
    if (clinicId) {
      fetchData();
    }
  }, [clinicId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/clinic/public-package?clinicId=${clinicId}&patientId=${patientId}`);
      if (response.data.success) {
        setServices(response.data.services || []);
        setTreatments(response.data.treatments || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTreatmentSelect = (treatment: any, subcategoryIndex: number = 0) => {
    const subcategory = treatment.subcategories?.[subcategoryIndex];
    const basePrice = subcategory?.price || 0;
    
    const exists = selectedTreatments.find(t => t.treatmentSlug === treatment.slug && t.subcategoryIndex === subcategoryIndex);
    if (exists) {
      setSelectedTreatments(selectedTreatments.filter(t => !(t.treatmentSlug === treatment.slug && t.subcategoryIndex === subcategoryIndex)));
    } else {
      setSelectedTreatments([
        ...selectedTreatments,
        {
          treatmentName: treatment.name,
          treatmentSlug: treatment.slug,
          subcategoryName: subcategory?.name || treatment.name,
          subcategoryIndex,
          sessions: 1,
          sessionPrice: basePrice,
          allocatedPrice: basePrice,
        }
      ]);
    }
  };

  const updateTreatmentSessions = (treatmentSlug: string, subcategoryIndex: number, sessions: number) => {
    setSelectedTreatments(selectedTreatments.map(t => {
      if (t.treatmentSlug === treatmentSlug && t.subcategoryIndex === subcategoryIndex) {
        return {
          ...t,
          sessions,
          allocatedPrice: t.sessionPrice * sessions,
        };
      }
      return t;
    }));
  };

  const handleServiceSelect = (service: any, price: number) => {
    const exists = selectedTreatments.find(t => t.treatmentSlug === service.serviceSlug && t.isService);
    if (exists) {
      setSelectedTreatments(selectedTreatments.filter(t => !(t.treatmentSlug === service.serviceSlug && t.isService)));
    } else {
      setSelectedTreatments([
        ...selectedTreatments,
        {
          treatmentName: service.name,
          treatmentSlug: service.serviceSlug,
          serviceId: service._id,
          sessions: 1,
          sessionPrice: price,
          allocatedPrice: price,
          isService: true,
        }
      ]);
    }
  };

  const handleServiceUpdate = (serviceSlug: string, sessions: number) => {
    setSelectedTreatments(selectedTreatments.map(t => {
      if (t.treatmentSlug === serviceSlug && t.isService) {
        return {
          ...t,
          sessions,
          allocatedPrice: t.sessionPrice * sessions,
        };
      }
      return t;
    }));
  };

  const calculateTotal = () => {
    return selectedTreatments.reduce((sum, t) => sum + (t.allocatedPrice || 0), 0);
  };

  const calculateTotalSessions = () => {
    return selectedTreatments.reduce((sum, t) => sum + (t.sessions || 0), 0);
  };

  const handleSubmit = async () => {
    if (selectedTreatments.length === 0) {
      alert('Please select at least one treatment');
      return;
    }

    if (!patientNameInput.trim()) {
      alert('Please enter patient name');
      return;
    }

    if (!patientMobileInput.trim()) {
      alert('Please enter phone number');
      return;
    }

    try {
      setSubmitting(true);
      const totalSessions = calculateTotalSessions();
      const totalPrice = calculateTotal();
      const sessionPrice = totalSessions > 0 ? totalPrice / totalSessions : 0;

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + parseInt(duration));

      const response = await axios.post('/api/clinic/public-package', {
        clinicId,
        patientId,
        patientName: patientNameInput,
        patientMobile: patientMobileInput,
        patientEmail: patientEmailInput,
        packageName: packageName || `Package for ${patientNameInput}`,
        totalPrice,
        totalSessions,
        sessionPrice,
        treatments: selectedTreatments,
        endDate: endDate.toISOString(),
      });

      if (response.data.success) {
        setSuccess(true);
      }
    } catch (error: any) {
      console.error("Error creating package:", error);
      alert(error.response?.data?.message || 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  // Show success message
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Package Created!</h2>
          <p className="text-gray-600 mb-6">
            Your package has been created successfully. The clinic will review and approve your package shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-teal-700 transition-colors"
          >
            Create Another Package
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-lg mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Package</h1>
          <p className="text-gray-600">Select treatments to create a custom package</p>
        </div>

        {/* Patient Info Card */}
        {patientName && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={patientNameInput}
                  onChange={(e) => setPatientNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter patient name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={patientMobileInput}
                  onChange={(e) => setPatientMobileInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={patientEmailInput}
                  onChange={(e) => setPatientEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter email"
                />
              </div>
            </div>
          </div>
        )}

        {/* Package Name Input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Package Name</h2>
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="e.g., Smile Design Package, Dental Care Plan, etc."
          />
          <p className="text-xs text-gray-500 mt-2">Give your package a name to easily identify it later</p>
        </div>

        {/* Services Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Select Services</h2>
          
          {services.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No services available</p>
          ) : (
            <div className="space-y-3">
              {services.map((service: any) => {
                const isSelected = selectedTreatments.some(t => t.treatmentSlug === service.serviceSlug && t.serviceId);
                const selectedTreatment = selectedTreatments.find(t => t.treatmentSlug === service.serviceSlug && t.serviceId);
                const price = service.clinicPrice || service.price;
                const sessionCount = selectedTreatment?.sessions || 1;
                
                return (
                  <div 
                    key={service._id || service.serviceSlug}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-teal-500 bg-teal-50' 
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                    onClick={() => handleServiceSelect(service, price)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-500">{service.durationMinutes} mins</p>
                      </div>
                    </div>
                    
                    {isSelected && selectedTreatment ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sessionCount > 1) {
                              handleServiceUpdate(service.serviceSlug, sessionCount - 1);
                            }
                          }}
                          className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 text-sm"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold w-8 text-center">{sessionCount}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceUpdate(service.serviceSlug, sessionCount + 1);
                          }}
                          className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 text-sm"
                        >
                          +
                        </button>
                        <span className="ml-2 font-bold text-teal-600 text-sm">
                          AED {(price * sessionCount).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-gray-700">AED {price}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Treatments Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Select Treatments</h2>
          
          {treatments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No treatments available</p>
          ) : (
            <div className="space-y-4">
              {treatments.map((treatment: any) => (
                <div key={treatment._id || treatment.slug} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Treatment Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">{treatment.name}</h3>
                  </div>
                  
                  {/* Subcategories with prices */}
                  {treatment.subcategories && treatment.subcategories.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {treatment.subcategories.map((subcat: any, idx: number) => {
                        const isSelected = selectedTreatments.some(t => t.treatmentSlug === treatment.slug && t.subcategoryIndex === idx);
                        const selectedTreatment = selectedTreatments.find(t => t.treatmentSlug === treatment.slug && t.subcategoryIndex === idx);
                        
                        return (
                          <div key={idx} className="p-4">
                            <div 
                              className={`flex items-center justify-between cursor-pointer ${isSelected ? 'bg-teal-50 -mx-4 px-4 py-2 rounded-lg' : ''}`}
                              onClick={() => handleTreatmentSelect(treatment, idx)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{subcat.name}</p>
                                  <p className="text-xs text-gray-500">AED {subcat.price} per session</p>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                {(() => {
                                  const sessionCount = selectedTreatment?.sessions || 1;
                                  return isSelected && selectedTreatment ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (sessionCount > 1) {
                                            updateTreatmentSessions(treatment.slug, idx, sessionCount - 1);
                                          }
                                        }}
                                        className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 text-sm"
                                      >
                                        -
                                      </button>
                                      <span className="text-sm font-semibold w-8 text-center">{sessionCount}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateTreatmentSessions(treatment.slug, idx, sessionCount + 1);
                                        }}
                                        className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 text-sm"
                                      >
                                        +
                                      </button>
                                      <span className="ml-2 font-bold text-teal-600 text-sm">
                                        AED {(subcat.price * sessionCount).toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-700">AED {subcat.price}</span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Package Summary */}
        {selectedTreatments.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-lg p-6 mb-6 text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Package Summary
            </h2>

            <div className="space-y-3 mb-6">
              {selectedTreatments.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{t.treatmentName} x {t.sessions} session(s)</span>
                  <span className="font-semibold">AED {t.allocatedPrice?.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Sessions</span>
                <span className="font-bold text-lg">{calculateTotalSessions()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Per Session</span>
                <span className="font-semibold">AED {(calculateTotal() / calculateTotalSessions()).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <span className="text-lg">Total Price</span>
                <span className="text-2xl font-bold text-teal-400">AED {calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Duration */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Package Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months</option>
              </select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedTreatments.length === 0}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Package
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

(CreatePackagePage as any).getLayout = function PageLayout(page: React.ReactNode) {
  return page;
};