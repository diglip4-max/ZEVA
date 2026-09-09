import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Search, ChevronDown, X, Check } from "lucide-react";

interface Props {
  onCancel: () => void;
  onCreated: (offer: any) => void;
  token: string;
  mode?: "create" | "update";
  offer?: any;
  actorRole?: "clinic" | "doctor" | "agent" | "admin" | "doctorStaff";
}

export default function CreateOfferWizard({
  onCancel,
  onCreated,
  token,
  mode = "create",
  offer,
  actorRole = "clinic",
}: Props) {
  // const headerClass = "bg-teal-100";
  // const subtitleClass = "text-teal-700";
  // const formBgClass = "bg-white";
  // const footerBgClass = "border-t bg-white";
  // const cancelBtnVariant = "border-gray-300 text-gray-700 hover:bg-gray-100";
  // const submitBtnVariant = "bg-gray-800 hover:bg-gray-900";
  const getInitialForm = () => ({
    title: "",
    description: "",
    offerType: "instant_discount" as "instant_discount" | "bundle" | "cashback",
    code: "",
    slug: "",
    startsAt: "",
    endsAt: "",
    timezone: "Asia/Kolkata",
    status: "draft" as "draft" | "active" | "paused" | "expired" | "archived",
    enabled: true,
    usesCount: 0,

    // Applicability Control
    applyOnType: "all_services" as "all_services" | "selected_services" | "selected_departments" | "selected_doctors",
    applyOnAllServices: true,
    serviceIds: [] as string[],
    departmentIds: [] as string[],
    doctorIds: [] as string[],

    // Stacking & Control Rules
    allowCombiningWithOtherOffers: false,
    allowReceptionistDiscount: false,
    maxBenefitCap: 30,
    minimumBillAmount: 0,
    marginThresholdPercent: 0,
    sameDayReuseBlocked: true,
    partialPaymentAllowed: false,

    // Smart Toggles
    autoApplyBestOffer: true,
    allowManualOverride: false,
    requireApprovalForOverride: true,
    blockIfProfitMarginBelowX: true,

    // Type 1: Instant Discount
    discountMode: "percentage" as "percentage" | "flat",
    discountValue: 0,

    // Type 2: Bundle
    buyQty: 0,
    freeQty: 0,

    // Type 3: Cashback
    cashbackAmount: 0,
    cashbackExpiryDays: 0,
  });
  const [form, setForm] = useState(getInitialForm);

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Data for selections
  const [allServices, setAllServices] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);

  // Track service count for selected departments
  const [departmentServiceCount, setDepartmentServiceCount] = useState<number>(0);

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
  const [showLinkedWarning, setShowLinkedWarning] = useState(false);
  const [linkedServicesMessage, setLinkedServicesMessage] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { id: 1, title: "Offer Type" },
    { id: 2, title: "Basic Info" },
    { id: 3, title: "Applicability" },
    { id: 4, title: "Type Configuration" },
    { id: 5, title: "Controls & Protection" },
  ];

  const handleNextStep = () => {
    // Basic per-step validation
    const newErrors: Record<string, string> = {};
    const errorMessages: string[] = [];

    if (currentStep === 2) {
      if (!form.title || form.title.trim().length === 0) {
        newErrors.title = "Offer title is required";
        errorMessages.push("Please fill in the Offer Name");
      }
      if (!form.startsAt) {
        newErrors.startsAt = "Start date is required";
        errorMessages.push("Please select a Start Date");
      }
      if (!form.endsAt) {
        newErrors.endsAt = "End date is required";
        errorMessages.push("Please select an End Date");
      }
      if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
        newErrors.endsAt = "End date must be after start date";
        errorMessages.push("End Date must be after Start Date");
      }
    } else if (currentStep === 4) {
      if (form.offerType === "instant_discount" && form.discountValue <= 0) {
        newErrors.discountValue = "Discount value must be greater than 0";
        errorMessages.push("Please enter a valid Discount Value greater than 0");
      }
      if (form.offerType === "bundle" && (form.buyQty <= 0 || form.freeQty <= 0)) {
        newErrors.bundle = "Buy and Free quantities must be greater than 0";
        errorMessages.push("Please enter valid Buy and Free quantities for Bundle offer");
      }
      if (form.offerType === "cashback" && form.cashbackAmount <= 0) {
        newErrors.cashbackAmount = "Cashback amount must be greater than 0";
        errorMessages.push("Please enter a valid Cashback Amount greater than 0");
      }
    }

    if (errorMessages.length > 0) {
      setErrors(newErrors);
      errorMessages.forEach((message, index) => {
        setTimeout(() => {
          toast.error(message, {
            duration: 4000,
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: '13px', fontWeight: '500' },
            icon: '⚠️',
          });
        }, index * 300);
      });
      return;
    }

    setErrors({});
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

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
    if (!token) {
      setResolvedToken("");
      return;
    }
    const nextToken = resolveTokenFromContext();
    setResolvedToken(nextToken);
  }, [token, actorRole]);

  useEffect(() => {
    const authToken = resolvedToken;
    if (!authToken) {
      setClinicId(null);
      setAllServices([]);
      setAllDepartments([]);
      setAllDoctors([]);
      setPermissions({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canRead: false,
      });
      return;
    }

    const fetchAllData = async () => {
      try {
        // Fetch everything in parallel
        const [
          clinicRes,
          permissionsRes,
          servicesRes,
          departmentsRes,
          doctorsRes
        ] = await Promise.all([
          fetch("/api/lead-ms/get-clinic-treatment", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/clinic/permissions", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/clinic/services", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/clinic/departments?module", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch("/api/lead-ms/get-agents?role=doctorStaff", {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        const clinicData = await clinicRes.json();
        if (clinicData.success) {
          setClinicId(clinicData.clinicId);
        }

        const servicesData = await servicesRes.json();
        if (servicesData.success) {
          setAllServices(servicesData.services || servicesData.data || []);
        }

        const departmentsData = await departmentsRes.json();
        if (departmentsData.success) {
          setAllDepartments(departmentsData.departments || departmentsData.data || []);
        }

        const doctorsData = await doctorsRes.json();
        if (doctorsData.success) {
          setAllDoctors(doctorsData.agents || doctorsData.data || []);
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
            setPermissions({
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              canRead: false,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };

    fetchAllData();
  }, [resolvedToken]);

  useEffect(() => {
    if (mode === "create") {
      setForm(getInitialForm());
      setErrors({});
      setShowSuccessPopup(false);
      return;
    }

    if (mode === "update" && offer) {
      console.log('Loading offer for update:', offer);
      console.log('Offer serviceIds (raw):', offer.serviceIds);
      console.log('Offer departmentIds (raw):', offer.departmentIds);
      console.log('Offer doctorIds (raw):', offer.doctorIds);

      // Handle both populated objects and raw IDs
      const extractIds = (items: any[]) => {
        if (!Array.isArray(items)) return [];
        return items.map((item: any) => {
          // If it's a populated object, get the _id
          if (item && typeof item === 'object' && item._id) {
            return String(item._id);
          }
          // If it's already a string/ObjectId
          return String(item);
        });
      };

      const serviceIds = extractIds(offer.serviceIds || []);
      const departmentIds = extractIds(offer.departmentIds || []);
      const doctorIds = extractIds(offer.doctorIds || []);

      console.log('Extracted serviceIds:', serviceIds);
      console.log('Extracted departmentIds:', departmentIds);
      console.log('Extracted doctorIds:', doctorIds);

      setForm({
        title: offer.title || "",
        description: offer.description || "",
        offerType: offer.offerType || "instant_discount",
        code: offer.code || "",
        slug: offer.slug || "",
        startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString().slice(0, 16) : "",
        endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString().slice(0, 16) : "",
        timezone: offer.timezone || "Asia/Kolkata",
        status: offer.status || "draft",
        enabled: offer.enabled ?? true,
        usesCount: offer.usesCount || 0,

        applyOnType: offer.applyOnAllServices ? "all_services" :
          offer.departmentIds?.length > 0 ? "selected_departments" :
            offer.doctorIds?.length > 0 ? "selected_doctors" :
              offer.serviceIds?.length > 0 ? "selected_services" : "all_services",
        applyOnAllServices: offer.applyOnAllServices ?? true,
        serviceIds: serviceIds,
        departmentIds: departmentIds,
        doctorIds: doctorIds,

        allowCombiningWithOtherOffers: offer.allowCombiningWithOtherOffers || false,
        allowReceptionistDiscount: offer.allowReceptionistDiscount || false,
        maxBenefitCap: offer.maxBenefitCap || 0,
        minimumBillAmount: offer.minimumBillAmount || 0,
        marginThresholdPercent: offer.marginThresholdPercent || 0,
        sameDayReuseBlocked: offer.sameDayReuseBlocked ?? true,
        partialPaymentAllowed: offer.partialPaymentAllowed || false,

        autoApplyBestOffer: offer.autoApplyBestOffer ?? true,
        allowManualOverride: offer.allowManualOverride || false,
        requireApprovalForOverride: offer.requireApprovalForOverride ?? true,
        blockIfProfitMarginBelowX: offer.blockIfProfitMarginBelowX ?? true,

        discountMode: offer.discountMode || "percentage",
        discountValue: offer.discountValue || 0,

        buyQty: offer.buyQty || 0,
        freeQty: offer.freeQty || 0,

        cashbackAmount: offer.cashbackAmount || 0,
        cashbackExpiryDays: offer.cashbackExpiryDays || 0,
      });
      setClinicId(offer.clinicId || null);
    }
  }, [mode, offer]);

  // Calculate service count when departments are selected
  useEffect(() => {
    if (form.departmentIds.length > 0 && allServices.length > 0) {
      const count = allServices.filter(s =>
        form.departmentIds.includes(s.departmentId || s._id)
      ).length;
      setDepartmentServiceCount(count);
    } else {
      setDepartmentServiceCount(0);
    }
  }, [form.departmentIds, allServices]);

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

    if (["discountValue", "cashbackAmount", "cashbackExpiryDays", "buyQty", "freeQty", "maxBenefitCap", "minimumBillAmount", "marginThresholdPercent"].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: value ? Number(value) : 0 }));
      return;
    }

    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSelection = (listName: "serviceIds" | "departmentIds" | "doctorIds", id: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [listName]: checked
        ? [...prev[listName], id]
        : prev[listName].filter((item: string) => item !== id),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const errorMessages: string[] = [];

    if (!form.title || form.title.trim().length === 0) {
      newErrors.title = "Offer title is required";
      errorMessages.push("Please fill in the Offer Name");
    }

    if (form.offerType === "instant_discount" && form.discountValue <= 0) {
      newErrors.discountValue = "Discount value must be greater than 0";
      errorMessages.push("Please enter a valid Discount Value greater than 0");
    }

    if (form.offerType === "bundle" && (form.buyQty <= 0 || form.freeQty <= 0)) {
      newErrors.bundle = "Buy and Free quantities must be greater than 0";
      errorMessages.push("Please enter valid Buy and Free quantities for Bundle offer");
    }

    if (form.offerType === "cashback" && form.cashbackAmount <= 0) {
      newErrors.cashbackAmount = "Cashback amount must be greater than 0";
      errorMessages.push("Please enter a valid Cashback Amount greater than 0");
    }

    if (!form.startsAt) {
      newErrors.startsAt = "Start date is required";
      errorMessages.push("Please select a Start Date");
    }

    if (!form.endsAt) {
      newErrors.endsAt = "End date is required";
      errorMessages.push("Please select an End Date");
    }

    if (form.startsAt && form.endsAt) {
      if (new Date(form.endsAt) <= new Date(form.startsAt)) {
        newErrors.endsAt = "End date must be after start date";
        errorMessages.push("End Date must be after Start Date");
      }
    }

    if (form.maxBenefitCap <= 0) {
      newErrors.maxBenefitCap = "Max benefit cap is mandatory";
      errorMessages.push("Please enter a valid Max Total Benefit Cap");
    }

    setErrors(newErrors);

    // Show all validation errors in toaster notifications
    if (errorMessages.length > 0) {
      errorMessages.forEach((message, index) => {
        setTimeout(() => {
          toast.error(message, {
            duration: 4000,
            style: {
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontSize: '13px',
              fontWeight: '500',
            },
            icon: '⚠️',
          });
        }, index * 300); // Stagger toasts for better UX
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    if (!clinicId) {
      toast.error("Clinic ID not found. Please try again or contact support.", {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          fontSize: '13px',
          fontWeight: '500',
        },
      });
      return;
    }

    if (mode === "create" && !permissions.canCreate) {
      toast.error("You do not have permission to create offers", {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          fontSize: '13px',
          fontWeight: '500',
        },
      });
      return;
    }
    if (mode === "update" && !permissions.canUpdate) {
      toast.error("You do not have permission to update offers", {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          fontSize: '13px',
          fontWeight: '500',
        },
      });
      return;
    }

    // If this is a pending submit after user confirmation, proceed directly
    if (pendingSubmit) {
      setPendingSubmit(false);
      await submitOffer();
      return;
    }

    // First, try to submit to check for linked services
    setLoading(true);
    try {
      const authToken = resolvedToken || resolveTokenFromContext();
      const url = mode === "create" ? "/api/lead-ms/create-offer" : `/api/lead-ms/update-offer?id=${offer._id}`;
      const method = mode === "create" ? "POST" : "PUT";

      // Final adjustments based on applyOnType
      const finalForm = { ...form };
      finalForm.applyOnAllServices = form.applyOnType === "all_services";

      // When applyOnAllServices is true, populate serviceIds with all clinic services
      if (form.applyOnType === "all_services") {
        finalForm.serviceIds = allServices.map(s => s._id);
      } else {
        if (form.applyOnType !== "selected_services") finalForm.serviceIds = [];
        if (form.applyOnType !== "selected_departments") finalForm.departmentIds = [];
        if (form.applyOnType !== "selected_doctors") finalForm.doctorIds = [];
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...finalForm,
          clinicId,
          startsAt: new Date(form.startsAt),
          endsAt: new Date(form.endsAt),
        }),
      });

      const data = await res.json();

      // Check if error is about already linked treatments
      if (!data.success && data.message && data.message.toLowerCase().includes('already linked')) {
        setLinkedServicesMessage(data.message);
        setShowLinkedWarning(true);
        setLoading(false);
        return;
      }

      if (data.success) {
        onCreated(data.offer);
        setShowSuccessPopup(true);
        toast.success(`Offer ${mode === "create" ? "created" : "updated"} successfully!`, {
          duration: 3000,
          style: {
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            fontSize: '13px',
            fontWeight: '500',
          },
        });
        setTimeout(() => {
          setShowSuccessPopup(false);
          onCancel && onCancel();
        }, 2000);
      } else {
        toast.error(data.message || "Failed to save offer", {
          duration: 4000,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            fontSize: '13px',
            fontWeight: '500',
          },
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving offer. Please try again.", {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          fontSize: '13px',
          fontWeight: '500',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to submit offer after user confirms
  const submitOffer = async () => {
    setLoading(true);
    try {
      const authToken = resolvedToken || resolveTokenFromContext();
      const url = mode === "create" ? "/api/lead-ms/create-offer" : `/api/lead-ms/update-offer?id=${offer._id}`;
      const method = mode === "create" ? "POST" : "PUT";

      // Final adjustments based on applyOnType
      const finalForm = { ...form };
      finalForm.applyOnAllServices = form.applyOnType === "all_services";

      // When applyOnAllServices is true, populate serviceIds with all clinic services
      if (form.applyOnType === "all_services") {
        finalForm.serviceIds = allServices.map(s => s._id);
      } else {
        if (form.applyOnType !== "selected_services") finalForm.serviceIds = [];
        if (form.applyOnType !== "selected_departments") finalForm.departmentIds = [];
        if (form.applyOnType !== "selected_doctors") finalForm.doctorIds = [];
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...finalForm,
          clinicId,
          startsAt: new Date(form.startsAt),
          endsAt: new Date(form.endsAt),
          forceUpdate: true, // Flag to bypass duplicate check
        }),
      });

      const data = await res.json();
      if (data.success) {
        onCreated(data.offer);
        setShowSuccessPopup(true);
        toast.success(`Offer ${mode === "create" ? "created" : "updated"} successfully!`, {
          duration: 3000,
          style: {
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            fontSize: '13px',
            fontWeight: '500',
          },
        });
        toast.success("Treatment linkage updated despite existing connections", {
          duration: 4000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b',
            fontSize: '13px',
            fontWeight: '500',
          },
          icon: '✅',
        });
        setTimeout(() => {
          setShowSuccessPopup(false);
          if (onCancel) onCancel();
        }, 2000);
      } else {
        toast.error(data.message || "Failed to save offer", {
          duration: 4000,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            fontSize: '13px',
            fontWeight: '500',
          },
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving offer. Please try again.", {
        duration: 4000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          fontSize: '13px',
          fontWeight: '500',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAF9F6] w-full flex flex-col">
      <div className="bg-white shadow-sm rounded-xl overflow-hidden flex flex-col w-full border border-gray-100">
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100 bg-white shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mode === "create" ? "Create Offer" : "Update Offer"}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Every offer is protected by margin rules, stacking limits and usage controls by default.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center text-xs font-medium text-gray-400 overflow-x-auto pb-2 scrollbar-hide">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center whitespace-nowrap ${currentStep === step.id ? 'text-teal-700' : currentStep > step.id ? 'text-gray-800' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 text-[10px] ${currentStep === step.id ? 'bg-teal-600 text-white' : currentStep > step.id ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step.id}
                  </div>
                  {step.title}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-8 h-px bg-gray-200 mx-3 shrink-0"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-[#FAF9F6] flex-1 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

            {/* Step 1: Offer Type */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Choose the offer type</h3>
                  <p className="text-sm text-gray-500">Each type follows different rules — ZEVA configures protections automatically.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    onClick={() => setForm({ ...form, offerType: 'instant_discount' })}
                    className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${form.offerType === 'instant_discount' ? 'border-teal-600 bg-teal-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                      <span className="text-gray-600 font-bold">%</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Instant Discount</h4>
                    <p className="text-xs text-gray-500">Applied directly to billing at checkout.</p>
                  </div>
                  <div
                    onClick={() => setForm({ ...form, offerType: 'bundle' })}
                    className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${form.offerType === 'bundle' ? 'border-teal-600 bg-teal-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mb-4 text-teal-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Bundle / Package</h4>
                    <p className="text-xs text-gray-500">Buy X sessions, receive X + Y free.</p>
                  </div>
                  <div
                    onClick={() => setForm({ ...form, offerType: 'cashback' })}
                    className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${form.offerType === 'cashback' ? 'border-teal-600 bg-teal-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Cashback / Wallet</h4>
                    <p className="text-xs text-gray-500">Patient pays full invoice, earns wallet credit.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Basic Info */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">Offer Name *</label>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.title ? "border-red-500" : "border-gray-200"}`}
                      placeholder="e.g., Summer Special 2024"
                      required
                    />
                    {errors.title && <p className="text-red-500 text-[10px] mt-1">{errors.title}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">Start Date *</label>
                    <input
                      type="datetime-local"
                      name="startsAt"
                      value={form.startsAt}
                      onChange={handleChange}
                      className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.startsAt ? "border-red-500" : "border-gray-200"}`}
                      required
                    />
                    {errors.startsAt && <p className="text-red-500 text-[10px] mt-1">{errors.startsAt}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">End Date *</label>
                    <input
                      type="datetime-local"
                      name="endsAt"
                      value={form.endsAt}
                      onChange={handleChange}
                      className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.endsAt ? "border-red-500" : "border-gray-200"}`}
                      required
                    />
                    {errors.endsAt && <p className="text-red-500 text-[10px] mt-1">{errors.endsAt}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="expired">Expired</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Applicability */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <label className="block text-[11px] font-semibold text-[#0E856E] mb-2">Apply On:</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { id: "all_services", label: "All Services" },
                    { id: "selected_services", label: "Selected Services" },
                    { id: "selected_departments", label: "Selected Departments" },
                    { id: "selected_doctors", label: "Selected Doctors" }
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-center py-2.5 px-3 border rounded-xl cursor-pointer transition-all text-xs font-medium text-center ${
                        form.applyOnType === opt.id
                          ? "bg-[#0E856E] text-white border-[#0E856E] shadow-sm font-semibold"
                          : "bg-white text-[#0E856E] border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="applyOnType"
                        value={opt.id}
                        checked={form.applyOnType === opt.id}
                        onChange={handleChange}
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {form.applyOnType === "selected_services" && (
                  <ApplicabilityDropdownPicker
                    title="Select Services"
                    placeholder="Click to select services..."
                    searchPlaceholder="Search services by name or slug..."
                    items={allServices}
                    selectedIds={form.serviceIds}
                    onToggle={(id, checked) => toggleSelection("serviceIds", id, checked)}
                    onSelectAll={() => setForm((prev) => ({ ...prev, serviceIds: allServices.map((s) => String(s._id || s.id)) }))}
                    onClearAll={() => setForm((prev) => ({ ...prev, serviceIds: [] }))}
                    getId={(s) => String(s._id || s.id || s.serviceSlug || '')}
                    getName={(s) => s.name || s.mainTreatment || s.serviceName || 'Unnamed Service'}
                    getSubLabel={(s) => {
                      const parts = [];
                      if (s.serviceSlug) parts.push(s.serviceSlug);
                      if (s.price) parts.push(`₹${s.price}`);
                      if (s.departmentId?.name) parts.push(s.departmentId.name);
                      return parts.join(" • ") || s.description || '';
                    }}
                  />
                )}

                {form.applyOnType === "selected_departments" && (
                  <ApplicabilityDropdownPicker
                    title="Select Departments"
                    placeholder="Click to select departments..."
                    searchPlaceholder="Search departments..."
                    items={allDepartments}
                    selectedIds={form.departmentIds}
                    onToggle={(id, checked) => toggleSelection("departmentIds", id, checked)}
                    onSelectAll={() => setForm((prev) => ({ ...prev, departmentIds: allDepartments.map((d) => String(d._id || d.id)) }))}
                    onClearAll={() => setForm((prev) => ({ ...prev, departmentIds: [] }))}
                    getId={(d) => String(d._id || d.id || d.departmentSlug || '')}
                    getName={(d) => d.name || d.title || 'Unnamed Department'}
                    getSubLabel={(d) => d.description || d.departmentSlug || ''}
                    summaryText={
                      form.departmentIds.length > 0
                        ? `${form.departmentIds.length} department${form.departmentIds.length > 1 ? 's' : ''} selected (${departmentServiceCount} service${departmentServiceCount !== 1 ? 's' : ''} included)`
                        : undefined
                    }
                  />
                )}

                {form.applyOnType === "selected_doctors" && (
                  <ApplicabilityDropdownPicker
                    title="Select Doctors"
                    placeholder="Click to select doctors..."
                    searchPlaceholder="Search doctors by name or specialty..."
                    items={allDoctors}
                    selectedIds={form.doctorIds}
                    onToggle={(id, checked) => toggleSelection("doctorIds", id, checked)}
                    onSelectAll={() => setForm((prev) => ({ ...prev, doctorIds: allDoctors.map((doc) => String(doc._id || doc.id)) }))}
                    onClearAll={() => setForm((prev) => ({ ...prev, doctorIds: [] }))}
                    getId={(doc) => String(doc._id || doc.id || '')}
                    getName={(doc) => doc.name || doc.fullName || doc.doctorName || 'Unnamed Doctor'}
                    getSubLabel={(doc) => doc.role || doc.specialty || doc.department || ''}
                  />
                )}
              </div>
            )}

            {/* Step 4: Type Configuration */}
            {currentStep === 4 && (
              <div className="space-y-4">
                {form.offerType === "instant_discount" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Discount Mode</label>
                      <select
                        name="discountMode"
                        value={form.discountMode}
                        onChange={handleChange}
                        className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (OFF)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Discount Value *</label>
                      <input
                        type="number"
                        name="discountValue"
                        value={form.discountValue}
                        onChange={handleChange}
                        className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.discountValue ? "border-red-500" : "border-gray-200"}`}
                        required
                      />
                      {errors.discountValue && <p className="text-red-500 text-[10px] mt-1">{errors.discountValue}</p>}
                    </div>
                  </div>
                )}

                {form.offerType === "bundle" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      {errors.bundle && <p className="text-red-500 text-[10px] mb-2">{errors.bundle}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Buy Quantity (Paid)</label>
                      <input
                        type="number"
                        name="buyQty"
                        value={form.buyQty}
                        onChange={handleChange}
                        className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Get Free Quantity</label>
                      <input
                        type="number"
                        name="freeQty"
                        value={form.freeQty}
                        onChange={handleChange}
                        className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {form.offerType === "cashback" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Cashback Amount</label>
                      <input
                        type="number"
                        name="cashbackAmount"
                        value={form.cashbackAmount}
                        onChange={handleChange}
                        className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.cashbackAmount ? "border-red-500" : "border-gray-200"}`}
                      />
                      {errors.cashbackAmount && <p className="text-red-500 text-[10px] mt-1">{errors.cashbackAmount}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-teal-700 mb-1">Wallet Credit Expiry (Days)</label>
                      <input
                        type="number"
                        name="cashbackExpiryDays"
                        value={form.cashbackExpiryDays}
                        onChange={handleChange}
                        className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Controls & Protection */}
            {currentStep === 5 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      name="autoApplyBestOffer"
                      checked={form.autoApplyBestOffer}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-teal-900">Auto Apply Best Offer</span>
                      <span className="text-[10px] text-gray-500">System automatically picks highest benefit</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      name="allowCombiningWithOtherOffers"
                      checked={form.allowCombiningWithOtherOffers}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-teal-900">Allow Stacking</span>
                      <span className="text-[10px] text-gray-500">Combine with other active offers</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      name="allowReceptionistDiscount"
                      checked={form.allowReceptionistDiscount}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-teal-900">Allow Receptionist Discount</span>
                      <span className="text-[10px] text-gray-500">Can be combined with manual discounts</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">Max Total Benefit Cap *</label>
                    <input
                      type="number"
                      name="maxBenefitCap"
                      value={form.maxBenefitCap}
                      onChange={handleChange}
                      className={`text-gray-900 w-full border rounded-lg px-2.5 py-2 text-xs sm:text-sm ${errors.maxBenefitCap ? "border-red-500" : "border-gray-200"}`}
                      placeholder="e.g., 30"
                      required
                    />
                    {errors.maxBenefitCap && <p className="text-red-500 text-[10px] mt-1">{errors.maxBenefitCap}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-teal-700 mb-1">Minimum Billing Amount (Optional)</label>
                    <input
                      type="number"
                      name="minimumBillAmount"
                      value={form.minimumBillAmount}
                      onChange={handleChange}
                      className="text-gray-900 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm"
                      placeholder="e.g., 1000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6 gap-3 shrink-0">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Previous
              </button>
            )}
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm font-medium transition-colors shadow-sm flex items-center"
              >
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || (mode === "create" && !permissions.canCreate) || (mode === "update" && !permissions.canUpdate)}
                className="px-6 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? "Saving..." : mode === "create" ? "Create Offer" : "Update Offer"}
              </button>
            )}
          </div>
        </div>
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

      {/* Linked Services Warning Popup */}
      {showLinkedWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4 transform transition-all">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4">
                <svg
                  className="h-8 w-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Treatment Already Linked</h3>
              <p className="text-sm text-gray-600 mb-4">
                {linkedServicesMessage}
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Do you want to proceed anyway? This will update the treatment linkage.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowLinkedWarning(false);
                    setLinkedServicesMessage("");
                  }}
                  className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLinkedWarning(false);
                    setPendingSubmit(true);
                    // Trigger submit again with forceUpdate flag
                    setTimeout(() => submitOffer(), 100);
                  }}
                  className="px-6 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium text-sm shadow-sm"
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicabilityDropdownPicker({
  title,
  placeholder,
  searchPlaceholder,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  getId = (item: any) => String(item._id || item.id || ''),
  getName = (item: any) => item.name || item.mainTreatment || 'Unnamed',
  getSubLabel = (item: any) => item.serviceSlug || item.description || item.role || item.specialty || '',
  summaryText,
}: {
  title: string;
  placeholder: string;
  searchPlaceholder: string;
  items: any[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  getId?: (item: any) => string;
  getName?: (item: any) => string;
  getSubLabel?: (item: any) => string;
  summaryText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((item) => {
    const name = getName(item).toLowerCase();
    const sub = getSubLabel(item).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || sub.includes(q);
  });

  const selectedItems = items.filter((item) => {
    const id = String(getId(item) || '');
    return selectedIds.includes(id) || (item.serviceSlug && selectedIds.includes(item.serviceSlug));
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-[#0E856E] mb-1.5">
          {title}
        </label>

        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-white border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all shadow-sm ${
            isOpen ? "border-[#0E856E] ring-2 ring-teal-500/10" : "border-gray-200/90 hover:border-[#0E856E]"
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Search className="w-4 h-4 text-[#0E856E] shrink-0" />
            <span className={`text-xs font-medium truncate ${selectedIds.length === 0 ? "text-gray-400" : "text-gray-900"}`}>
              {selectedIds.length === 0
                ? placeholder
                : `${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'} selected`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedIds.length > 0 && (
              <span className="bg-[#0E856E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {selectedIds.length}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-[#0E856E]" : ""
              }`}
            />
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 w-full bg-white rounded-2xl border border-gray-200/90 shadow-md overflow-hidden transition-all">
            <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full text-xs bg-white border border-gray-200/90 rounded-xl pl-8 pr-8 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0E856E] focus:ring-1 focus:ring-[#0E856E]"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-[11px] font-semibold text-[#0E856E] hover:bg-teal-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-[11px] font-semibold text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  {items.length === 0 ? "No records available" : `No matches found for "${search}"`}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const id = String(getId(item) || '');
                  const isChecked = selectedIds.includes(id) || (item.serviceSlug && selectedIds.includes(item.serviceSlug));
                  const name = getName(item);
                  const sub = getSubLabel(item);

                  return (
                    <label
                      key={id || Math.random().toString()}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isChecked
                          ? "bg-teal-50/70 border-teal-200/80 text-teal-950 font-medium"
                          : "bg-white border-transparent hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => onToggle(id, e.target.checked)}
                          className="w-4 h-4 text-[#0E856E] border-gray-300 rounded focus:ring-[#0E856E]"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {name}
                          </span>
                          {sub && sub !== name && (
                            <span className="text-[11px] text-gray-400 font-normal truncate">
                              {sub}
                            </span>
                          )}
                        </div>
                      </div>
                      {isChecked && (
                        <Check className="w-4 h-4 text-[#0E856E] shrink-0" />
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium text-gray-600">
                {selectedIds.length} of {items.length} selected
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-[#0E856E] hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedItems.map((item) => {
            const id = String(getId(item) || '');
            const name = getName(item);
            return (
              <span
                key={id || Math.random().toString()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-800 text-xs font-medium rounded-xl border border-teal-200/80 shadow-xs"
              >
                <span className="max-w-[180px] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => onToggle(id, false)}
                  className="text-teal-600 hover:text-teal-950 rounded-full hover:bg-teal-100 p-0.5 transition-colors"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 transition-colors self-center"
          >
            Clear all
          </button>
        </div>
      )}

      {summaryText && (
        <div className="p-3 bg-teal-50/60 border border-teal-200/70 rounded-xl mt-2">
          <p className="text-xs text-teal-800 font-medium">{summaryText}</p>
        </div>
      )}
    </div>
  );
}
