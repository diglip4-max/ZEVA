// pages/consent-form/[id].tsx
import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import DOMPurify from "dompurify";
import { Check, Signature, Calendar, User, Trash2, CheckCircle } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface ConsentFormData {
  _id: string;
  formName: string;
  description: string;
  language: string;
  version: string;
  enableDigitalSignature: boolean;
  requireNameConfirmation: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  clinicName?: string | null;
}

interface PatientData {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  appointmentId?: string;
}

const ConsentFormPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consentForm, setConsentForm] = useState<ConsentFormData | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [todayDate, setTodayDate] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(false);
  const [understandResults, setUnderstandResults] = useState(false);
  const [error, setError] = useState("");
  const [signatureData, setSignatureData] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState(true);
  const [appointmentId, setAppointmentId] = useState<string>("");
  
  const signatureRef = useRef<SignatureCanvas>(null);

  // Get today's date in formatted way
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    setTodayDate(formattedDate);
  }, []);

  // Fetch consent form and patient data
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch consent form details
        const consentRes = await axios.get(`/api/public/consent/${id}`);
        if (consentRes.data.success) {
          setConsentForm(consentRes.data.consent);
        } else {
          setError("Consent form not found");
        }

        // Fetch patient data from URL query params or sessionStorage
        let patientFullName = "";
        const patientDataFromUrl = router.query.patient;
        
        if (patientDataFromUrl && typeof patientDataFromUrl === 'string') {
          try {
            const decoded = JSON.parse(decodeURIComponent(patientDataFromUrl)) as PatientData;
            console.log('Decoded patient data:', decoded);
            setPatient(decoded);
            setAppointmentId(decoded.appointmentId || "");
            sessionStorage.setItem(`patient_${id}`, JSON.stringify(decoded));
            patientFullName = `${decoded.firstName || ""} ${decoded.lastName || ""}`.trim();
          } catch (e) {
            console.error("Error parsing patient data:", e);
          }
        } else {
          const savedPatientData = sessionStorage.getItem(`patient_${id}`);
          console.log('Saved patient data from sessionStorage:', savedPatientData);
          if (savedPatientData) {
            const decoded = JSON.parse(savedPatientData) as PatientData;
            setPatient(decoded);
            setAppointmentId(decoded.appointmentId || "");
            patientFullName = `${decoded.firstName || ""} ${decoded.lastName || ""}`.trim();
          }
        }
        
        // Check if this patient already has a signature for this consent form
        if (patientFullName && typeof id === 'string') {
          await fetchExistingSignature(id, patientFullName);
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err?.response?.data?.message || "Failed to load consent form");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router.query.patient]);

  // Function to fetch existing signature
  const fetchExistingSignature = async (consentFormId: string, patientName: string) => {
    try {
      const response = await axios.get("/api/public/consent-signature-exists", {
        params: { consentFormId, patientName },
      });

      if (response.data.success && response.data.signature) {
        const sig = response.data.signature;
        
        // Load signature into canvas
        setSignatureData(sig.signature);
        
        // Set checkbox states
        setAgreedToTerms(sig.agreedToTerms || false);
        setQuestionsAnswered(sig.questionsAnswered || false);
        setUnderstandResults(sig.understandResults || false);
        setNameConfirmed(sig.nameConfirmed || "");
        
        // Mark canvas as not empty
        setIsEmpty(false);
        
        console.log('Loaded existing signature:', sig);
      }
    } catch (err: any) {
      console.error("Error fetching existing signature:", err);
      // Silently fail - user can just sign again
    }
  };

  const handleSignatureBegin = () => {
    setIsEmpty(false);
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current) {
      const dataURL = signatureRef.current.toDataURL('image/png');
      setSignatureData(dataURL);
    }
  };

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignatureData("");
      setIsEmpty(true);
    }
  };

  const handleSubmit = async () => {
    if (!consentForm) return;

    // Validation
    if (consentForm.requireNameConfirmation && !nameConfirmed.trim()) {
      alert("Please type your full name to confirm");
      return;
    }

    if (consentForm.enableDigitalSignature && !signatureData) {
      alert("Please provide your signature");
      return;
    }

    if (!agreedToTerms || !questionsAnswered || !understandResults) {
      alert("Please confirm all acknowledgment checkboxes");
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        consentFormId: id,
        patientName: `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim(),
        patientFirstName: patient?.firstName,
        patientLastName: patient?.lastName,
        date: todayDate,
        signature: signatureData,
        nameConfirmed: nameConfirmed,
        agreedToTerms: !!agreedToTerms,
        questionsAnswered: !!questionsAnswered,
        understandResults: !!understandResults,
        ipAddress: "", // Can add IP tracking if needed
        userAgent: typeof window !== "undefined" ? navigator.userAgent : "",
        appointmentId: appointmentId || null,
      };

      const { data } = await axios.post("/api/public/consent-signature", payload);
      
      if (data.success) {
        alert("Thank you! Your consent has been recorded successfully.");
        // Optionally redirect or show success message
        router.push("/consent-success");
      } else {
        alert(data.message || "Failed to submit consent");
      }
    } catch (err: any) {
      console.error("Error submitting consent:", err);
      alert(err?.response?.data?.message || "Failed to submit consent");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading consent form...</p>
        </div>
      </div>
    );
  }

  if (error || !consentForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Form</h2>
          <p className="text-gray-600 mb-6">{error || "Consent form not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{consentForm.formName} | Zeva360</title>
        <meta name="description" content="Patient consent form" />
      </Head>

      <div className="min-h-screen bg-gray-100 py-6 px-4 sm:py-10">
        <div className="max-w-[52rem] mx-auto">

          {/* ── Document Container ── */}
          <div className="bg-white shadow-xl border border-gray-200 rounded-sm">

            {/* ── Top Accent Bar ── */}
            <div className="h-1.5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />

            {/* ── Header ── */}
            <div className="px-8 sm:px-12 pt-8 pb-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                        {consentForm.formName}
                      </h1>
                      {consentForm.clinicName && (
                        <p className="text-sm text-gray-500 font-medium mt-0.5">{consentForm.clinicName}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-6">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Consent Form</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">v{consentForm.version}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{consentForm.language}</p>
                </div>
              </div>
            </div>

            {/* ── Patient Information Bar ── */}
            <div className="px-8 sm:px-12 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <User size={13} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Patient Name</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {patient
                        ? `${patient.firstName} ${patient.lastName}`.trim()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block w-px h-8 bg-gray-300" />
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Calendar size={13} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Date</p>
                    <p className="text-sm font-semibold text-gray-800">{todayDate}</p>
                  </div>
                </div>
                {appointmentId && (
                  <>
                    <div className="hidden sm:block w-px h-8 bg-gray-300" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Appointment</p>
                      <p className="text-sm font-mono text-gray-600">#{appointmentId.slice(-8)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Body Content ── */}
            <div className="px-8 sm:px-12 py-6">

              {/* Description / Treatment Content */}
              {consentForm.description && (
                <div className="mb-5">
                  <div
                    className="consent-description-content"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(consentForm.description),
                    }}
                  />

                  {/* View Consent Document Link */}
                  {consentForm.fileUrl && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                      <a
                        href={consentForm.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium hover:text-slate-900 transition-colors group"
                      >
                        <span className="w-7 h-7 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center group-hover:bg-slate-800 group-hover:border-slate-800 transition-all">
                          <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </span>
                        View Consent Document
                        {consentForm.fileName && (
                          <span className="text-xs text-gray-400 font-normal">({consentForm.fileName})</span>
                        )}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              <div className="border-t border-gray-200 my-5" />

              {/* ── Digital Signature ── */}
              {consentForm.enableDigitalSignature && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Signature size={15} className="text-slate-700" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Digital Signature</h2>
                  </div>

                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    {signatureData && !isEmpty ? (
                      <div className="p-4 bg-gray-50">
                        <div className="bg-white border border-gray-200 rounded-md p-2.5 mb-2">
                          <img
                            src={signatureData}
                            alt="Patient Signature"
                            className="w-full h-[120px] object-contain"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle size={13} />
                          <p className="text-[11px] font-medium">Signature captured</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <p className="text-[11px] text-gray-400 mb-2 font-medium uppercase tracking-wide">Sign below</p>
                        <SignatureCanvas
                          ref={signatureRef}
                          onBegin={handleSignatureBegin}
                          onEnd={handleSignatureEnd}
                          canvasProps={{
                            width: 600,
                            height: 140,
                            className: 'signature-canvas w-full h-[140px] border border-dashed border-gray-300 rounded-md bg-white',
                            style: { touchAction: 'none' }
                          }}
                        />
                      </div>
                    )}

                    {!signatureData || isEmpty ? (
                      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                        <p className="text-[11px] text-gray-400">Draw your signature using mouse or touch</p>
                        {signatureData && !isEmpty && (
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded transition-all"
                          >
                            <Trash2 size={12} />
                            Clear
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ── Divider ── */}
              <div className="border-t border-gray-200 my-5" />

              {/* ── Patient Acknowledgment ── */}
              <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2.5">Patient Acknowledgment</h2>

                <div className="space-y-0 divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
                  <label className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-all ${agreedToTerms ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"}`}>
                    <input
                      type="checkbox"
                      checked={!!agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      I confirm that I have read and understood all the information provided about this treatment.
                    </span>
                  </label>

                  <label className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-all ${questionsAnswered ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"}`}>
                    <input
                      type="checkbox"
                      checked={!!questionsAnswered}
                      onChange={(e) => setQuestionsAnswered(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      I have had the opportunity to ask questions and all my questions have been answered satisfactorily.
                    </span>
                  </label>

                  <label className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-all ${understandResults ? "bg-emerald-50/60" : "bg-white hover:bg-gray-50"}`}>
                    <input
                      type="checkbox"
                      checked={!!understandResults}
                      onChange={(e) => setUnderstandResults(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      I understand that results may vary and are not guaranteed.
                    </span>
                  </label>
                </div>
              </div>

              {/* ── Name Confirmation ── */}
              {consentForm.requireNameConfirmation && (
                <div className="mb-5">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2">Name Confirmation</h2>
                  <p className="text-xs text-gray-500 mb-1.5">Type your full legal name to confirm this consent</p>
                  <input
                    type="text"
                    value={nameConfirmed}
                    onChange={(e) => setNameConfirmed(e.target.value)}
                    placeholder={`${patient?.firstName || ""} ${patient?.lastName || ""}`.trim()}
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white font-medium text-gray-800"
                  />
                  {(signatureData && !isEmpty) && (
                    <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle size={12} />
                      Name confirmation provided
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer / Submit ── */}
            <div className="px-8 sm:px-12 py-4 bg-gray-50 border-t border-gray-200 rounded-b-sm">
              {/* Important Notice */}
              <div className="flex items-start gap-2.5 mb-4 px-3.5 py-2.5 bg-amber-50/80 border border-amber-200/70 rounded-md">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  This consent form is a legally binding document. By signing below, you acknowledge that you have read, understood, and agree to all the terms described above. A copy will be stored in your medical records.
                </p>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-slate-800 text-white font-semibold text-sm rounded-md hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Submit Consent
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-gray-400 mt-3">
                By submitting, you electronically sign this document under applicable law.
              </p>
            </div>

          </div>
          {/* ── End Document Container ── */}

        </div>
      </div>

      {/* ── Scoped Styles for Rich Text Content ── */}
      <style>{`
        .consent-description-content {
          color: #1f2937;
          font-size: 0.75rem;
          line-height: 1.65;
          font-family: 'Georgia', 'Times New Roman', serif;
        }
        .consent-description-content h1 {
          font-size: 0.9rem;
          font-weight: 700;
          color: #111827;
          margin-top: 1rem;
          margin-bottom: 0.3rem;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: -0.01em;
        }
        .consent-description-content h2 {
          font-size: 0.825rem;
          font-weight: 700;
          color: #111827;
          margin-top: 0.75rem;
          margin-bottom: 0.3rem;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: -0.01em;
        }
        .consent-description-content h3 {
          font-size: 0.775rem;
          font-weight: 600;
          color: #1f2937;
          margin-top: 0.6rem;
          margin-bottom: 0.25rem;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .consent-description-content p {
          margin-top: 0.35rem;
          margin-bottom: 0.35rem;
          text-align: justify;
        }
        .consent-description-content ul {
          list-style-type: disc;
          margin-left: 1.25rem;
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .consent-description-content ol {
          list-style-type: decimal;
          margin-left: 1.25rem;
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .consent-description-content li {
          margin-top: 0.15rem;
          margin-bottom: 0.15rem;
          color: #374151;
          padding-left: 0.25rem;
        }
        .consent-description-content strong,
        .consent-description-content b {
          font-weight: 700;
          color: #111827;
        }
        .consent-description-content em,
        .consent-description-content i {
          font-style: italic;
        }
        .consent-description-content u {
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .consent-description-content blockquote {
          border-left: 3px solid #9ca3af;
          padding-left: 1rem;
          font-style: italic;
          color: #6b7280;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
      `}</style>
    </>
  );
};

(ConsentFormPage as any).getLayout = function PageLayout(page: React.ReactNode) {
  return page;
};

export default ConsentFormPage;

// Add some custom styles for the signature canvas
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .signature-canvas {
      touch-action: none;
      cursor: crosshair;
    }
    .signature-canvas:focus {
      outline: none;
    }
  `;
  if (!document.getElementById('signature-canvas-styles')) {
    style.id = 'signature-canvas-styles';
    document.head.appendChild(style);
  }
}
