// components/JobPostingForm.tsx
import React, { useMemo, useState } from 'react';

const qualifications = [
  "B.Tech", "M.Tech", "BCA", "MCA", "Diploma in CS/IT",
  "B.Sc IT", "M.Sc IT", "BBA", "MBA", "Other Software",
  "MBBS", "BDS", "BAMS", "BHMS", "MD", "MS", "PhD",
  "Diploma", "Nursing", "Pharmacy", "Other Medical",
  "Graduate", "Post Graduate", "12th Pass", "10th Pass", "Other"
];

const departments = [
  "Software Development", "Frontend", "Backend", "Full Stack", "DevOps",
  "QA & Testing", "Automation Testing", "Manual Testing", "UI/UX", "Data Science",
  "AI/ML", "Cloud Computing", "Cybersecurity", "Database Administration",
  "Product Management", "Business Analysis",
  "General Medicine", "Cardiology", "Radiology", "Dental", "Pathology",
  "Pediatrics", "Orthopedics", "Gynecology", "Dermatology",
  "Anesthesiology", "Surgery", "ENT", "Psychiatry", "Physiotherapy",
  "Administration", "Pharmacy", "Research", "Other"
];

const jobTypes = ['Full Time', 'Part Time', 'Internship'];

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface JobFormData {
  companyName: string;
  jobTitle: string;
  department: string;
  qualification: string;
  jobType: string;
  location: string;
  jobTiming: string;
  skills: string;
  perks: string;
  languagesPreferred: string;
  description: string;
  noOfOpenings: string;
  salary: string;
  salaryType: string;   // ✅ Added
  experience: string;
  establishment: string;
  workingDays: string;
}


type FieldKey = keyof JobFormData;

interface JobPostingFormProps {
  onSubmit: (formData: JobFormData) => Promise<void>;
  isSubmitting?: boolean;
  title?: string;
  subtitle?: string;
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({
  onSubmit,
  isSubmitting = false,
  title = "Post a Job",
  subtitle = "Create a new job posting for your clinic"
}) => {
  const [formData, setFormData] = useState<JobFormData>({
    companyName: '',
    jobTitle: '',
    department: '',
    qualification: '',
    jobType: '',
    location: '',
    jobTiming: '',
    skills: '',
    perks: '',
    languagesPreferred: '',
    description: '',
    noOfOpenings: '',
    salary: '',
    salaryType: '',   // ✅ Added
    experience: '',
    establishment: '',
    workingDays: '',
  });


  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0..3
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Toast functions
  const addToast = (type: ToastType, title: string, message: string) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, title, message };
    setToasts(prev => [...prev, newToast]);

    // Auto remove toast after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setTouched(prev => ({ ...prev, [name]: true }));
    // live-validate the field
    const fieldError = validateField(name as FieldKey, value);
    setErrors(prev => ({ ...prev, [name]: fieldError }));
  };

  const sectionFields: FieldKey[][] = useMemo(() => ([
    // Section 0: Basic Information
    ['companyName', 'establishment', 'jobTitle', 'department', 'qualification', 'jobType', 'location'],
    // Section 1: Job Details
    ['jobTiming', 'workingDays', 'salary', 'salaryType', 'experience', 'noOfOpenings'],
    // Section 2: Job Description
    ['description'],
    // Section 3: Additional Requirements (no description)
    ['skills', 'perks', 'languagesPreferred'],
  ]), []);

  const validateField = (name: FieldKey, value: string): string => {
    if (!value || value.toString().trim() === '') {
      // SalaryType should only be required if salary is entered
      if (name === "salaryType") {
        if (formData.salary && formData.salary.trim() !== '') {
          return "Please select Per Month or Per Year";
        }
        return "";
      }
      return "This field is required"; // default message
    }

    if (name === 'noOfOpenings') {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return 'Enter a valid number greater than 0';
    }

    if (name === 'establishment') {
      if (!/^\d{2,4}$/.test(value.trim())) return 'Enter a valid year (e.g., 2015)';
    }

    if (name === 'salary') {
      // If salary is entered, salaryType becomes required
      if (value && value.trim() !== '' && (!formData.salaryType || formData.salaryType.trim() === '')) {
        // Set salaryType error as well
        setErrors(prev => ({ ...prev, salaryType: 'Please select Per Month or Per Year' }));
      } else if ((!value || value.trim() === '') && formData.salaryType) {
        // If salary is cleared but salaryType is still selected, clear salaryType error
        setErrors(prev => ({ ...prev, salaryType: '' }));
      }
    }

    return '';
  };

  const validateSection = (step: number): Record<string, string> => {
    const fields = sectionFields[step] || [];
    const sectionErrors: Record<string, string> = {};
    fields.forEach((f) => {
      const err = validateField(f, formData[f] || '');
      if (err) sectionErrors[f] = err;
    });

    // Additional validation for salary and salaryType dependency
    if (fields.includes('salary') || fields.includes('salaryType')) {
      if (formData.salary && formData.salary.trim() !== '' && (!formData.salaryType || formData.salaryType.trim() === '')) {
        sectionErrors.salaryType = 'Please select Per Month or Per Year';
      }
    }

    return sectionErrors;
  };

  const validateAll = (): Record<string, string> => {
    const allErrors: Record<string, string> = {};
    sectionFields.flat().forEach((f) => {
      const err = validateField(f, formData[f] || '');
      if (err) allErrors[f] = err;
    });

    // Additional validation for salary and salaryType dependency
    if (formData.salary && formData.salary.trim() !== '' && (!formData.salaryType || formData.salaryType.trim() === '')) {
      allErrors.salaryType = 'Please select Per Month or Per Year';
    }

    return allErrors;
  };

  const goNext = () => {
    const sectionErrs = validateSection(currentStep);
    setErrors(prev => ({ ...prev, ...sectionErrs }));
    // mark section touched so errors show
    const touchedUpdate: Record<string, boolean> = {};
    sectionFields[currentStep].forEach(f => { touchedUpdate[f] = true; });
    setTouched(prev => ({ ...prev, ...touchedUpdate }));
    if (Object.keys(sectionErrs).length > 0) {
      addToast('error', 'Incomplete Section', 'Please fill all required fields to continue');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, sectionFields.length - 1));
  };

  const goBack = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleSubmit = () => {
    const allErrs = validateAll();
    setErrors(prev => ({ ...prev, ...allErrs }));
    // mark all touched
    const allTouched: Record<string, boolean> = {};
    sectionFields.flat().forEach(f => { allTouched[f] = true; });
    setTouched(prev => ({ ...prev, ...allTouched }));
    if (Object.keys(allErrs).length > 0) {
      addToast('error', 'Missing Required Fields', 'Please complete all fields before submitting');
      // jump to first invalid section
      for (let i = 0; i < sectionFields.length; i++) {
        const fields = sectionFields[i];
        if (fields.some(f => allErrs[f])) { setCurrentStep(i); break; }
      }
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    try {
      // ✅ Normalize salary before sending
      let salaryRaw: string = formData.salary ? formData.salary.replace(/,/g, "") : "";

      if (salaryRaw.includes("-")) {
        const [min, max] = salaryRaw
          .split("-")
          .map((v: string) => v.trim()); // 👈 typed as string
        salaryRaw = `${Number(min)} - ${Number(max)}`; // ✅ send as "1111 - 2222"
      } else if (salaryRaw) {
        salaryRaw = `${Number(salaryRaw)}`; // ✅ "1111"
      }



      const payload = {
        ...formData,
        salary: salaryRaw,
        salaryType: formData.salaryType, // ✅ explicitly included
      };

      await onSubmit(payload);

      addToast('success', 'Job Posted Successfully!', 'Your job posting is now live and candidates can apply');
      setShowConfirmModal(false);

      // Reset form
      setFormData({
        companyName: '',
        jobTitle: '',
        department: '',
        qualification: '',
        jobType: '',
        location: '',
        jobTiming: '',
        skills: '',
        perks: '',
        languagesPreferred: '',
        description: '',
        noOfOpenings: '',
        salary: '',
        salaryType: '',   // ✅ reset as well
        experience: '',
        establishment: '',
        workingDays: '',
      });
      setErrors({});
      setTouched({});
      setCurrentStep(0);
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to Post Job', 'There was an error posting your job. Please try again or contact support.');
    }
  };


  // Confirmation Modal Component
  const ConfirmationModal = () => (
    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Job Posting</h3>
                <p className="text-sm text-gray-600">Please review your job details before posting</p>
              </div>
            </div>
            <button
              onClick={() => setShowConfirmModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Job Details Review */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Company Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.companyName || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Job Title</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.jobTitle || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Department</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.department || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Job Type</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.jobType || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Qualification</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.qualification || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Location</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.location || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Salary</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.salary || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Experience</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.experience || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Number of Openings</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{formData.noOfOpenings || '1'}</p>
              </div>
            </div>

            {formData.description && (
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Job Description</label>
                <p className="text-sm text-gray-900 mt-1">{formData.description}</p>
              </div>
            )}

            {formData.skills && (
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Required Skills</label>
                <p className="text-sm text-gray-900 mt-1">{formData.skills}</p>
              </div>
            )}

            {formData.perks && (
              <div className="bg-gray-50/80 backdrop-blur-sm p-3 rounded-lg border border-gray-200/50">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Perks & Benefits</label>
                <p className="text-sm text-gray-900 mt-1">{formData.perks}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100/80 backdrop-blur-sm rounded-lg hover:bg-gray-200/80 transition-all duration-200 font-medium border border-gray-200/50"
            >
              Go Back & Edit
            </button>
            <button
              onClick={confirmSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#2D9AA5] text-white rounded-lg hover:bg-[#247a83] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Posting Job...
                </>
              ) : (
                "Confirm & Post Job"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Toast Container Component
  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm w-full">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={`w-full bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden transform transition-all duration-500 ease-out ${index === toasts.length - 1 ? 'animate-slide-in' : ''
            }`}
          style={{
            animation: index === toasts.length - 1 ? 'slideIn 0.5s ease-out' : 'none'
          }}
        >
          {/* Colored top border */}
          <div className={`h-1 w-full ${toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
              toast.type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
            }`} />

          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-green-100' :
                toast.type === 'error' ? 'bg-red-100' :
                  toast.type === 'warning' ? 'bg-yellow-100' :
                    'bg-blue-100'
                }`}>
                {toast.type === 'success' && (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {toast.type === 'error' && (
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {toast.type === 'warning' && (
                  <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3c4.97 0 9 9 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9z" />
                  </svg>
                )}
                {toast.type === 'info' && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {toast.title}
                </p>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 ml-2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div className="h-1 bg-gray-100">
            <div
              className={`h-full transition-all duration-[5000ms] ease-linear ${toast.type === 'success' ? 'bg-green-400' :
                toast.type === 'error' ? 'bg-red-400' :
                  toast.type === 'warning' ? 'bg-yellow-400' :
                    'bg-blue-400'
                }`}
              style={{
                width: '100%',
                animation: 'progress 5s linear forwards'
              }}
            />
          </div>
        </div>
      ))}

      {/* CSS animations */}
      <style jsx>{`
      @keyframes progress {
        0% { width: 100%; }
        100% { width: 0%; }
      }
      
      @keyframes slideIn {
        0% {
          transform: translateX(100%);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      /* Mobile responsive adjustments */
      @media (max-width: 640px) {
        .fixed.top-4.right-4 {
          top: 1rem;
          right: 1rem;
          left: 1rem;
          max-width: none;
        }
      }
    `}</style>
    </div>
  );

  // Debug log for troubleshooting Establishment Year error display
  console.log('errors:', errors, 'touched:', touched, 'formData:', formData);

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 md:p-4 lg:p-6">
      <div className="max-w-xs sm:max-w-sm md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-[#2D9AA5] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6.001" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                {title}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5 sm:mt-1">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Form - Multi-step slider */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 lg:p-8 overflow-hidden">
          {/* Step indicators */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 overflow-x-auto">
            <div className="flex items-center min-w-max w-full justify-between">
              {['Basic Information', 'Job Details', 'Job Description', 'Additional Requirements'].map((label, idx) => (
                <div key={label} className="flex-1 flex items-center min-w-0">
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-semibold ${currentStep >= idx ? 'bg-[#2D9AA5] text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {idx + 1}
                    </div>
                    <span className="text-xs sm:text-sm text-gray-600 mt-1 text-center hidden sm:block">
                      {label.split(' ').map((word, i) => (
                        <span key={i} className="block">{word}</span>
                      ))}
                    </span>
                    <span className="text-xs text-gray-600 mt-1 text-center block sm:hidden">
                      Step {idx + 1}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`h-0.5 sm:h-1 flex-1 mx-1 sm:mx-2 ${currentStep > idx ? 'bg-[#2D9AA5]' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sliding container */}
          <div className="relative w-full overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ width: '400%', transform: `translateX(-${currentStep * 25}%)` }}
            >
              {/* Section 1: Basic Information */}
              <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Company Name */}
                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="companyName"
                      value={formData.companyName}
                      placeholder="Enter company name"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.companyName && errors.companyName && (
                      <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>
                    )}
                  </div>

                  {/* Establishment Year */}
                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Establishment Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="establishment"
                      value={formData.establishment}
                      placeholder="Enter establishment year"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.establishment && errors.establishment && (
                      <p className="mt-1 text-xs text-red-600">{errors.establishment}</p>
                    )}
                  </div>

                  {/* Job Title */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Job Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="jobTitle"
                      value={formData.jobTitle}
                      placeholder="Enter job title"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.jobTitle && errors.jobTitle && (
                      <p className="mt-1 text-xs text-red-600">{errors.jobTitle}</p>
                    )}
                  </div>

                  {/* Department */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dep) => (
                        <option key={dep} value={dep}>
                          {dep}
                        </option>
                      ))}
                    </select>
                    {touched.department && errors.department && (
                      <p className="mt-1 text-xs text-red-600">{errors.department}</p>
                    )}
                  </div>

                  {/* Qualification */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Required Qualification
                    </label>
                    <select
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    >
                      <option value="">Select Qualification</option>
                      {qualifications.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                    {touched.qualification && errors.qualification && (
                      <p className="mt-1 text-xs text-red-600">{errors.qualification}</p>
                    )}
                  </div>

                  {/* Job Type */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Job Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="jobType"
                      value={formData.jobType}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    >
                      <option value="">Select Job Type</option>
                      {jobTypes.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                    {touched.jobType && errors.jobType && (
                      <p className="mt-1 text-xs text-red-600">{errors.jobType}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Location
                    </label>
                    <input
                      name="location"
                      value={formData.location}
                      placeholder="Enter location"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.location && errors.location && (
                      <p className="mt-1 text-xs text-red-600">{errors.location}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Job Details */}
              <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Job Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Job Timing
                    </label>
                    <input
                      name="jobTiming"
                      value={formData.jobTiming}
                      placeholder="e.g. 9 AM - 6 PM"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.jobTiming && errors.jobTiming && <p className="mt-1 text-xs text-red-600">{errors.jobTiming}</p>}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Working Days
                    </label>
                    <input
                      name="workingDays"
                      placeholder="e.g. Monday–Friday"
                      value={formData.workingDays}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.workingDays && errors.workingDays && <p className="mt-1 text-xs text-red-600">{errors.workingDays}</p>}
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Salary
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        name="salary"
                        value={formData.salary}
                        placeholder="e.g. 10,000 or 10,000 - 20,000"
                        onChange={(e) => {
                          let rawValue = e.target.value;

                          // Allow only digits, commas, spaces, and hyphen
                          if (/^[0-9,\s-]*$/.test(rawValue)) {
                            // Remove commas before formatting
                            const cleaned = rawValue.replace(/,/g, "");

                            if (cleaned.includes("-")) {
                              // Split into range
                              const [min, max] = cleaned.split("-").map((v) => v.trim());
                              const formattedMin = min && !isNaN(Number(min)) ? Number(min).toLocaleString("en-IN") : "";
                              const formattedMax = max && !isNaN(Number(max)) ? Number(max).toLocaleString("en-IN") : "";
                              rawValue =
                                formattedMin + (cleaned.includes("-") ? " - " : "") + (formattedMax ? formattedMax : "");
                            } else {
                              // Single number formatting
                              rawValue = cleaned && !isNaN(Number(cleaned)) ? Number(cleaned).toLocaleString("en-IN") : "";
                            }

                            setFormData(prev => ({ ...prev, salary: rawValue }));
                            setTouched(prev => ({ ...prev, salary: true }));
                            // Validate both salary and salaryType when salary changes
                            const salaryError = validateField('salary', rawValue);
                            const salaryTypeError = validateField('salaryType', formData.salaryType);
                            setErrors(prev => ({ ...prev, salary: salaryError, salaryType: salaryTypeError }));
                          }
                        }}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                      />

                      <select
                        name="salaryType"
                        value={formData.salaryType}
                        onChange={handleChange}
                        className="w-full sm:w-auto sm:min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                      >
                        <option value="">Select</option>
                        <option value="month">Per Month</option>
                        <option value="year">Per Year</option>
                      </select>
                    </div>

                    {touched.salary && errors.salary && (
                      <p className="mt-1 text-xs text-red-600">{errors.salary}</p>
                    )}
                    {touched.salaryType && errors.salaryType && (
                      <p className="mt-1 text-xs text-red-600">{errors.salaryType}</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Experience
                    </label>
                    <input
                      name="experience"
                      value={formData.experience}
                      placeholder="Enter Experience"
                      onChange={handleChange}
                      className="text-black w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] transition-colors text-xs sm:text-sm md:text-base placeholder-gray-500"
                    />
                    {touched.experience && errors.experience && (
                      <p className="mt-1 text-xs text-red-600">{errors.experience}</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Number of Openings
                    </label>
                    <input
                      name="noOfOpenings"
                      type="number"
                      value={formData.noOfOpenings}
                      placeholder="Enter number"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.noOfOpenings && errors.noOfOpenings && <p className="mt-1 text-xs text-red-600">{errors.noOfOpenings}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3: Job Description */}
              <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Job Description</h3>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    placeholder="Describe the job role, responsibilities, and requirements..."
                    onChange={handleChange}
                    rows={window.innerWidth < 640 ? 4 : 5}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition resize-none"
                  />
                  {touched.description && errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
                </div>
              </div>

              {/* Section 4: Additional Requirements */}
              <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Additional Requirements</h3>
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Required Skills
                      <span className="text-gray-500 text-xs ml-1">(comma separated)</span>
                    </label>
                    <input
                      name="skills"
                      value={formData.skills}
                      placeholder="e.g. Communication, Team Work, Problem Solving"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.skills && errors.skills && <p className="mt-1 text-xs text-red-600">{errors.skills}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Perks & Benefits
                      <span className="text-gray-500 text-xs ml-1">(comma separated)</span>
                    </label>
                    <input
                      name="perks"
                      value={formData.perks}
                      placeholder="e.g. Health Insurance, Paid Leave, Training"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.perks && errors.perks && <p className="mt-1 text-xs text-red-600">{errors.perks}</p>}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Preferred Languages
                      <span className="text-gray-500 text-xs ml-1">(comma separated)</span>
                    </label>
                    <input
                      name="languagesPreferred"
                      value={formData.languagesPreferred}
                      placeholder="e.g. English, Hindi, Local Language"
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-500 focus:border-[#2D9AA5] focus:ring-2 focus:ring-[#2D9AA5] transition"
                    />
                    {touched.languagesPreferred && errors.languagesPreferred && <p className="mt-1 text-xs text-red-600">{errors.languagesPreferred}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-200 mt-4 sm:mt-6">
            <button
              onClick={goBack}
              disabled={currentStep === 0}
              className="px-3 sm:px-4 md:px-6 py-2 text-sm sm:text-base rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            {currentStep < sectionFields.length - 1 ? (
              <button
                onClick={goNext}
                className="bg-[#2D9AA5] text-white px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-lg hover:bg-[#247a83] transition-colors font-medium text-sm sm:text-base"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="bg-[#2D9AA5] text-white px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-lg hover:bg-[#247a83] transition-colors font-medium text-sm sm:text-base"
              >
                Review & Submit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && <ConfirmationModal />}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
export default JobPostingForm;
export type { JobFormData };