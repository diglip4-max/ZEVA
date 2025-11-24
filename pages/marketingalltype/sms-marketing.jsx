// pages/marketingalltype/sms-marketing.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import DOMPurify from "dompurify";
import { TrendingUp, FileCheck, Wallet } from "lucide-react";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import DltVerificationPanel, { buildInitialDocState } from "../../components/DltVerificationPanel";
import SmsRoiPanel from "../../components/marketing/SmsRoiPanel";
import SmsTopupPanel from "../../components/marketing/SmsTopupPanel";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const ADD_METHODS = [
  { id: "manual", label: "Enter Manually" },
  { id: "csv", label: "CSV File Upload" },
];

const MESSAGE_MODES = [
  { id: "manual", label: "Enter Message Manually" },
  { id: "template", label: "Use SMS Template", disabled: false },
];

const SmsSender = () => {
  const [addMethod, setAddMethod] = useState("manual");
  const [messageMode, setMessageMode] = useState("manual");
  const [numbersInput, setNumbersInput] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [language, setLanguage] = useState("english");
  const [senderId, setSenderId] = useState("776500");
  const [shortUrlEnabled, setShortUrlEnabled] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [csvMeta, setCsvMeta] = useState({ fileName: "", rows: 0, error: "" });
  const [showRoiModal, setShowRoiModal] = useState(false);
  const [showDltModal, setShowDltModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [docUploads, setDocUploads] = useState(buildInitialDocState());
  const [authToken, setAuthToken] = useState("");
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored =
      localStorage.getItem("clinicToken") ||
      localStorage.getItem("doctorToken");
    if (stored) {
      setAuthToken(stored);
    }
  }, []);

  // Fetch wallet balance on mount to check before sending
  useEffect(() => {
    if (!authToken) {
      setWalletLoading(false);
      return;
    }
    const fetchWallet = async () => {
      try {
        setWalletLoading(true);
        const res = await axios.get("/api/marketing/wallet/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setWallet(res.data?.data || null);
      } catch (error) {
        console.error("wallet fetch error", error);
        setWallet(null);
      } finally {
        setWalletLoading(false);
      }
    };
    fetchWallet();
  }, [authToken]);

  const charCount = useMemo(() => messageBody.length, [messageBody]);
  const recipientsPreview = useMemo(
    () =>
      numbersInput
        .split(/[\s,\n,]+/)
        .map((num) => num.trim())
        .filter((num) => /^\+?\d{10,15}$/.test(num)),
    [numbersInput]
  );
  const creditsPerRecipient = Math.max(1, Math.ceil(charCount / 160));
  const totalCreditsPreview = recipientsPreview.length * creditsPerRecipient;
  const lowBalanceThreshold = wallet?.lowBalanceThreshold ?? 50;
  const isWalletLow = wallet ? wallet.balance <= lowBalanceThreshold : false;
  const creditBadgeClass = walletLoading
    ? "border-slate-200 bg-slate-50 text-slate-500"
    : isWalletLow
    ? "border-rose-200 bg-rose-50 text-rose-700 animate-pulse"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const extractRecipients = () =>
    numbersInput
      .split(/[\s,\n,]+/)
      .map((num) => num.trim())
      .filter((num) => /^\+?\d{10,15}$/.test(num));

  const resetForm = () => {
    setNumbersInput("");
    setTemplateId("");
    setMessageBody("");
    setLanguage("english");
    setSenderId("776500");
    setShortUrlEnabled(false);
    setScheduleEnabled(false);
    setScheduleTime("");
    setStatus("");
    setResults([]);
    setCsvMeta({ fileName: "", rows: 0, error: "" });
    setDocUploads(buildInitialDocState());
  };

  const handleCsvUpload = async (file) => {
    if (!file) return;
    setCsvMeta({ fileName: file.name, rows: 0, error: "" });
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") {
          throw new Error("Unable to read file.");
        }
        const lines = text.split(/\r?\n/);
        const numbers = [];
        lines.forEach((line) => {
          line
            .split(/[,;]/)
            .map((token) => token.trim())
            .forEach((token) => {
              if (/^\+?\d{10,15}$/.test(token)) {
                numbers.push(token);
              }
            });
        });
        if (numbers.length === 0) {
          setCsvMeta({ fileName: file.name, rows: 0, error: "No valid numbers found in CSV." });
          return;
        }
        setNumbersInput(numbers.join(", "));
        setCsvMeta({ fileName: file.name, rows: numbers.length, error: "" });
      } catch (err) {
        setCsvMeta({
          fileName: file.name,
          rows: 0,
          error: err instanceof Error ? err.message : "Failed to parse CSV.",
        });
      }
    };
    reader.onerror = () => {
      setCsvMeta({ fileName: file.name, rows: 0, error: "Unable to read the file." });
    };
    reader.readAsText(file);
  };

  const handleDocumentUpload = async (docId, file) => {
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setDocUploads((prev) => ({
        ...prev,
        [docId]: { status: "error", url: "", error: "Cloudinary configuration missing" },
      }));
      return;
    }

    setDocUploads((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], status: "uploading", error: "" },
    }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.secure_url) {
        throw new Error(data.error?.message || "Upload failed");
      }
      setDocUploads((prev) => ({
        ...prev,
        [docId]: { status: "done", url: data.secure_url, error: "" },
      }));
    } catch (err) {
      setDocUploads((prev) => ({
        ...prev,
        [docId]: { status: "error", url: "", error: err instanceof Error ? err.message : "Upload failed" },
      }));
    }
  };


  const handleSubmit = async () => {
    setStatus("");
    setResults([]);

    if (addMethod !== "manual") {
      setStatus("❌ This import method is not supported yet. Please enter numbers manually.");
      return;
    }

    const recipients = extractRecipients();
    if (recipients.length === 0) {
      setStatus("❌ Please enter at least one valid mobile number.");
      return;
    }

    if (!messageBody.trim()) {
      setStatus("❌ Message content cannot be empty.");
      return;
    }

    try {
      setLoading(true);
      const cleanBody = DOMPurify.sanitize(messageBody.trim());
      const creditsPerRecipientLocal = Math.max(1, Math.ceil(cleanBody.length / 160));
      const creditsNeeded = creditsPerRecipientLocal * recipients.length;
      if (wallet && wallet.balance < creditsNeeded) {
        setStatus(
          `❌ You need ${creditsNeeded} credits for this send, but only ${wallet.balance} are available. Please request a top-up.`
        );
        setLoading(false);
        return;
      }
      const token =
        authToken ||
        (typeof window !== "undefined" && (localStorage.getItem("clinicToken") || localStorage.getItem("doctorToken")));
      if (!token) {
        setStatus("❌ No authentication token found.");
        return;
      }

      const payload = {
        to: recipients,
        title: templateId || "SMS Campaign",
        body: cleanBody,
        meta: {
          language,
          senderId,
          shortUrlEnabled,
          schedule: scheduleEnabled ? scheduleTime : null,
        },
      };

    const res = await axios.post("/api/marketing/sms-send", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

    if (res.data.success) {
        setStatus("✅ Messages queued successfully.");
        setResults(res.data.data || []);
        // Update wallet balance locally
        setWallet((prev) =>
          prev
            ? {
                ...prev,
              balance: Math.max(prev.balance - creditsNeeded, 0),
              totalSent: (prev.totalSent || 0) + creditsNeeded,
              }
            : prev
        );
      } else {
        setStatus("❌ Failed: " + (res.data.error || "Unknown error"));
      }
    } catch (err) {
      const statusCode = err?.response?.status;
      if (statusCode === 402) {
        setStatus(err?.response?.data?.message || "Insufficient SMS credits. Please request a top-up.");
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setStatus(`❌ Error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] py-2 px-1">
      <div className="mx-auto max-w-7xl space-y-2">
        {/* Header */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-2.5">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-500">Send SMS</p>
              <h1 className="text-base font-bold text-slate-900 mt-0.5">Assigned Leads Broadcast</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Share updates, offers or alerts with your customers in seconds.</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-1">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Messaging IO Active
              </span>
            </div>
          </div>
        </section>

        {/* Quick Action Boxes */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => setShowRoiModal(true)}
            className="group bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 hover:shadow-md hover:border-blue-300 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">ROI Analytics</p>
                <p className="text-xs font-bold text-slate-900">View Performance</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Track your SMS campaign ROI</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowDltModal(true)}
            className="group bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 hover:shadow-md hover:border-red-300 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-md flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCheck className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">DLT Verification</p>
                <p className="text-xs font-bold text-slate-900">Registration</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Complete DLT verification</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowTopupModal(true)}
            className="group bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 hover:shadow-md hover:border-blue-300 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">SMS Wallet</p>
                <p className="text-xs font-bold text-slate-900">Top-up Credits</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Manage your SMS balance</p>
              </div>
            </div>
          </button>
        </section>

        {/* Form */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Add numbers */}
          <div className="border-b border-slate-200 px-2.5 py-2 space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5">Add numbers via</p>
                <div className="flex flex-wrap gap-2">
                  {ADD_METHODS.map(({ id, label, disabled }) => (
                    <button
                      key={id}
                      disabled={disabled}
                      onClick={() => setAddMethod(id)}
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        addMethod === id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-600 border-slate-200"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${creditBadgeClass}`}>
                <span className="uppercase tracking-[0.2em]">Credits Left</span>
                <span className="text-base font-bold">
                  {walletLoading ? "Loading..." : wallet ? wallet.balance.toLocaleString() : "N/A"}
                </span>
                {wallet && (
                  <span className="text-[10px] font-medium text-slate-500">
                    Threshold {lowBalanceThreshold.toLocaleString()}
                  </span>
                )}
                {isWalletLow && <span className="text-[10px] font-semibold">Low balance</span>}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wide">
                {addMethod === "csv" ? "Upload CSV File" : "Enter Mobile Numbers"}
              </label>
              {addMethod === "csv" ? (
                <div className="mt-2 space-y-3">
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-center cursor-pointer hover:border-blue-400 transition">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => handleCsvUpload(e.target.files?.[0] || null)}
                    />
                    <svg className="w-6 h-6 text-blue-500 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M4 12l4 4m0 0l4-4m-4 4V4" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-700">Click to upload CSV</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Each row should contain one mobile number</span>
                  </label>
                  {csvMeta.fileName && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">{csvMeta.fileName}</p>
                      <p>{csvMeta.rows} numbers detected</p>
                      {csvMeta.error && <p className="text-rose-500 text-xs mt-1">{csvMeta.error}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    rows={2}
                    placeholder="Enter mobile numbers here 91123XXXXXX, 90182XXXXXX, 98102XXXXXX"
                    value={numbersInput}
                    onChange={(e) => setNumbersInput(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <p className="text-[10px] text-rose-500 mt-0.5">Mobile numbers are required.</p>
                </>
              )}
            </div>
          </div>

          <div className="px-2.5 py-2 space-y-2.5">
            {/* Message composer */}
            <section className="grid gap-2.5 lg:grid-cols-[180px,1fr]">
              <div>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5">Message Mode</p>
                <div className="space-y-2">
                  {MESSAGE_MODES.map(({ id, label, disabled }) => (
                    <button
                      key={id}
                      disabled={disabled}
                      onClick={() => setMessageMode(id)}
                      className={`w-full text-left px-3 py-1.5 rounded-md border text-xs ${
                        messageMode === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-semibold uppercase text-slate-500 tracking-wide mb-1">DLT Template ID</label>
                  <input
                    type="text"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    placeholder="Enter template ID that is approved on DLT platform"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold uppercase text-slate-500 tracking-wide mb-1">Message Content</label>
                  <textarea
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Enter message here..."
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 transition resize-none"
                  />
          <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 mt-0.5 sm:flex-row sm:items-center sm:justify-between">
            <span>{charCount} characters</span>
            <div className="text-right space-y-0.5 sm:space-y-0">
              <span className="block">
                {creditsPerRecipient} SMS credits per recipient
              </span>
              {recipientsPreview.length > 0 && (
                <span className="block">
                  Total cost: {totalCreditsPreview.toLocaleString()}{" "}
                  {wallet
                    ? `• Projected remaining: ${Math.max(wallet.balance - totalCreditsPreview, 0).toLocaleString()}`
                    : ""}
                </span>
              )}
            </div>
          </div>
                </div>
              </div>
            </section>

            {/* Meta settings */}
            <section className="grid gap-2.5 md:grid-cols-2">
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-semibold uppercase text-slate-500 tracking-wide mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="marathi">Marathi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-semibold uppercase text-slate-500 tracking-wide mb-1">From</label>
                  <input
                    type="text"
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shortUrlEnabled}
                    onChange={(e) => setShortUrlEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Enable URL Shortener</p>
                    <p className="text-xs text-slate-500">Shorten the URLs present in your SMS to reduce character count.</p>
                  </div>
                </label>

                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scheduleEnabled}
                      onChange={(e) => setScheduleEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Schedule</p>
                      <p className="text-xs text-slate-500">Plan delivery of this message for the future.</p>
                    </div>
                  </label>
                  {scheduleEnabled && (
                    <input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="w-full sm:w-auto px-3 py-1.5 rounded-full border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                onClick={resetForm}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Review & Send"}
              </button>
            </section>

            {/* Status & Results */}
            {status && (
              <div
                className={`border rounded-lg px-2.5 py-2 text-xs ${
                  status.includes("✅") ? "border-green-200 bg-green-50 text-green-800" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {status}
              </div>
            )}

            {results.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-[10px] font-semibold text-slate-700 mb-1.5">Delivery Report</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {results.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-md px-2 py-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px]">{item.to}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          item.status === "success" || item.status === "queued" ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.error && <span className="text-[11px] text-rose-500 ml-2">({item.error})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <SmsRoiPanel open={showRoiModal} onClose={() => setShowRoiModal(false)} />
      <DltVerificationPanel
        open={showDltModal}
        onClose={() => setShowDltModal(false)}
        docUploads={docUploads}
        onUpload={handleDocumentUpload}
      />
      <SmsTopupPanel
        open={showTopupModal}
        onClose={() => setShowTopupModal(false)}
        authToken={authToken}
        onBalanceUpdate={(updatedWallet) => setWallet(updatedWallet)}
      />
    </div>
  );
};

SmsSender.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;
const ProtectedSmsSender = withClinicAuth(SmsSender);
ProtectedSmsSender.getLayout = SmsSender.getLayout;

export default ProtectedSmsSender;


