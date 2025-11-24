// pages/marketingalltype/gmail-marketing.jsx
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import "react-quill/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

// Helper to strip HTML tags
const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "").trim();

// Helper to sanitize HTML (client-side only)
const sanitizeHtml = (html, options = {}) => {
  if (typeof window === "undefined") {
    // Server-side: just return the HTML as-is (will be sanitized on client)
    return html;
  }
  
  // Client-side: use DOMPurify
  const DOMPurify = require("dompurify");
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class'],
    ...options
  });
};

const GmailSender = () => {
  const [serviceType, setServiceType] = useState("gmail"); // "gmail" or "brevo"
  const [mode, setMode] = useState("single");
  const [singleEmail, setSingleEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState([]);
  
  // Brevo-specific state
  const [campaignName, setCampaignName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [listIds, setListIds] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [brevoMode, setBrevoMode] = useState("transactional"); // "transactional" or "campaign"

  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  // Image Upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setImageUrl(data.secure_url);
        setStatus("✅ Image uploaded successfully!");
      } else {
        setStatus("❌ Failed to upload image");
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    setLoading(true);
    setStatus("");
    setResults([]);

    try {
      // Get auth token
      const token = localStorage.getItem("clinicToken") || localStorage.getItem("adminToken") || localStorage.getItem("userToken");
      
      if (!token) {
        setStatus("❌ Authentication required. Please login again.");
        setLoading(false);
        return;
      }

      if (serviceType === "brevo") {
        // Brevo email campaign
        if (!subject || !body) {
          setStatus("❌ Subject and email body are required");
          setLoading(false);
          return;
        }

        // Build HTML content with image if available
        // ReactQuill already outputs HTML, so we sanitize it but keep the HTML structure
        let htmlContent = sanitizeHtml(body);
        
        // If body is empty, use a default
        if (!htmlContent || htmlContent.trim() === '') {
          htmlContent = '<p>No content provided</p>';
        }
        
        // Add image if available
        if (imageUrl) {
          htmlContent = `<img src="${imageUrl}" alt="Campaign Image" style="max-width: 100%; height: auto; margin-bottom: 20px;" /><br/>${htmlContent}`;
        }

        const payload = {
          campaignType: brevoMode,
        };

        if (brevoMode === "transactional") {
          // Transactional email - send immediately
          const recipients =
            mode === "single"
              ? [singleEmail]
              : bulkEmails
                  .split(",")
                  .map((email) => email.trim())
                  .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

          if (recipients.length === 0) {
            setStatus("❌ No valid recipient emails provided");
            setLoading(false);
            return;
          }

          if (!senderName || !senderEmail) {
            setStatus("❌ Sender name and email are required");
            setLoading(false);
            return;
          }

          payload.to = mode === "single" ? singleEmail : recipients;
          payload.subject = subject;
          payload.htmlContent = htmlContent;
          payload.textContent = stripHtml(sanitizeHtml(body));
          payload.sender = {
            name: senderName,
            email: senderEmail,
          };
        } else {
          // Scheduled campaign
          if (!campaignName) {
            setStatus("❌ Campaign name is required");
            setLoading(false);
            return;
          }

          if (!senderName || !senderEmail) {
            setStatus("❌ Sender name and email are required");
            setLoading(false);
            return;
          }

          payload.name = campaignName;
          payload.subject = subject;
          payload.htmlContent = htmlContent;
          payload.sender = {
            name: senderName,
            email: senderEmail,
          };
          payload.type = "classic";

          // Parse list IDs if provided
          if (listIds) {
            const parsedListIds = listIds
              .split(",")
              .map((id) => parseInt(id.trim()))
              .filter((id) => !isNaN(id));
            if (parsedListIds.length > 0) {
              payload.listIds = parsedListIds;
            }
          }

          // Schedule if provided
          if (scheduledAt) {
            payload.scheduledAt = scheduledAt;
          }
        }

        const res = await axios.post("/api/marketing/email-campaign", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setStatus(`✅ ${brevoMode === "transactional" ? "Email sent" : "Campaign created"} successfully!`);
          if (res.data.data) {
            setResults([{ to: "Campaign", status: "success", data: res.data.data }]);
          }
        } else {
          setStatus("❌ Failed: " + (res.data.message || "Unknown error"));
        }
      } else {
        // Original Gmail sending logic
        const cleanBody = stripHtml(sanitizeHtml(body));

        const recipients =
          mode === "single"
            ? [singleEmail]
            : bulkEmails
                .split(",")
                .map((email) => email.trim())
                .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

        if (recipients.length === 0) {
          setStatus("❌ No valid recipient emails provided");
          setLoading(false);
          return;
        }

        // Get auth token
        const token = localStorage.getItem("clinicToken") || localStorage.getItem("adminToken") || localStorage.getItem("userToken");
        
        if (!token) {
          setStatus("❌ Authentication required. Please login again.");
          setLoading(false);
          return;
        }

        const payload = {
          subject: subject || "Special Offer",
          body: cleanBody,
          mediaUrl: imageUrl || undefined,
          to: recipients,
        };

        const res = await axios.post("/api/marketing/gmail-send", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setStatus(`✅ Emails sent successfully!`);
          setResults(res.data.data);
        } else {
          setStatus("❌ Failed: " + (res.data.error || "Unknown error"));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Unknown error";
      setStatus("❌ Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Email Marketing</h1>
              <p className="text-gray-600 text-sm">Create and send professional email campaigns to your customers</p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-gray-700">Email Ready</span>
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-red-600 via-pink-600 to-red-600 rounded-full"></div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Service Type Toggle */}
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 p-7">
            <label className="block text-sm font-semibold text-gray-800 mb-3.5">Email Service</label>
            <div className="inline-flex rounded-xl bg-white shadow-sm border border-gray-300 p-1 mb-4">
              <button
                className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  serviceType === "gmail"
                    ? "bg-gradient-to-r from-red-600 to-pink-700 text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setServiceType("gmail")}
              >
                Gmail
              </button>
              <button
                className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  serviceType === "brevo"
                    ? "bg-gradient-to-r from-red-600 to-pink-700 text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setServiceType("brevo")}
              >
                Brevo Campaign
              </button>
            </div>
            
            {/* Mode Toggle */}
            {serviceType === "brevo" && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-800 mb-3.5">Brevo Mode</label>
                <div className="inline-flex rounded-xl bg-white shadow-sm border border-gray-300 p-1">
                  <button
                    className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      brevoMode === "transactional"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setBrevoMode("transactional")}
                  >
                    Transactional (Immediate)
                  </button>
                  <button
                    className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      brevoMode === "campaign"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setBrevoMode("campaign")}
                  >
                    Scheduled Campaign
                  </button>
                </div>
              </div>
            )}
            
            {/* Recipient Mode Toggle (for Gmail or Brevo Transactional) */}
            {(serviceType === "gmail" || (serviceType === "brevo" && brevoMode === "transactional")) && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-800 mb-3.5">Recipient Type</label>
                <div className="inline-flex rounded-xl bg-white shadow-sm border border-gray-300 p-1">
                  <button
                    className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      mode === "single"
                        ? "bg-gradient-to-r from-red-600 to-pink-700 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("single")}
                  >
                    Single Recipient
                  </button>
                  <button
                    className={`px-7 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      mode === "bulk"
                        ? "bg-gradient-to-r from-red-600 to-pink-700 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("bulk")}
                  >
                    Bulk Campaign
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Brevo Campaign Name (only for scheduled campaigns) */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                      Campaign Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Monthly Newsletter - December 2024"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                    />
                  </div>
                )}

                {/* Recipient Emails (for Gmail or Brevo Transactional) */}
                {(serviceType === "gmail" || (serviceType === "brevo" && brevoMode === "transactional")) && (
                  mode === "single" ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2.5">Recipient Email</label>
                      <input
                        type="email"
                        placeholder="example@gmail.com"
                        value={singleEmail}
                        onChange={(e) => setSingleEmail(e.target.value)}
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                        Recipient Emails <span className="text-gray-600 font-normal ml-2">(comma separated)</span>
                      </label>
                      <textarea
                        placeholder="example1@gmail.com, example2@gmail.com"
                        value={bulkEmails}
                        onChange={(e) => setBulkEmails(e.target.value)}
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none text-gray-900 placeholder:text-gray-500 font-medium"
                        rows={4}
                      />
                    </div>
                  )
                )}

                {/* Brevo List IDs (only for scheduled campaigns) */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                      Contact List IDs <span className="text-gray-600 font-normal ml-2">(comma separated, optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2, 7"
                      value={listIds}
                      onChange={(e) => setListIds(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the list IDs from your Brevo account</p>
                  </div>
                )}

                {/* Sender Info (for Brevo) */}
                {serviceType === "brevo" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                        Sender Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Ayurveda Clinic"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                        Sender Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g., noreply@ayurvedaclinic.com"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                      />
                      <p className="text-xs text-gray-500 mt-1">Must be a verified sender in your Brevo account</p>
                    </div>
                  </>
                )}

                {/* Scheduled Date (for Brevo Campaign) */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                      Schedule Date & Time <span className="text-gray-600 font-normal ml-2">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => {
                        const date = new Date(e.target.value);
                        const formatted = date.toISOString().slice(0, 19).replace('T', ' ');
                        setScheduledAt(formatted);
                      }}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty to send immediately</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2.5">Email Subject</label>
                  <input
                    type="text"
                    placeholder="e.g., Special Summer Discount"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-900 placeholder:text-gray-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2.5">Email Body</label>
                  <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                    <ReactQuill
                      value={body}
                      onChange={setBody}
                      modules={{
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ["bold", "italic", "underline", "strike"],
                          [{ list: "ordered" }, { list: "bullet" }],
                          ["link", "image"],
                          [{ color: [] }, { background: [] }],
                          ["clean"],
                        ],
                      }}
                      theme="snow"
                      placeholder="Write your promotional email here..."
                      className="h-40"
                    />
                  </div>
                  {serviceType === "brevo" && (
                    <p className="text-xs text-gray-500 mt-1">HTML formatting is supported for Brevo campaigns</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2.5">Email Image</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-red-400 transition-colors bg-gray-50">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={uploading} 
                      className="hidden" 
                      id="image-upload" 
                    />
                    <label 
                      htmlFor="image-upload" 
                      className={`flex flex-col items-center justify-center cursor-pointer ${uploading ? "opacity-50" : ""}`}
                    >
                      {!imageUrl ? (
                        <>
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <span className="text-base font-semibold text-gray-800 mb-1">
                            {uploading ? "Uploading..." : "Click to upload image"}
                          </span>
                          <span className="text-sm text-gray-500">PNG, JPG up to 10MB</span>
                        </>
                      ) : (
                        <div className="relative w-full">
                          <img src={imageUrl} alt="Uploaded" className="w-full h-64 object-cover rounded-xl border border-gray-200 shadow-sm" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setImageUrl("");
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1.5">Best Practices</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Use a clear subject line, personalize your message, and include a strong call-to-action for better engagement.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1.5">Delivery Tip</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Avoid spam triggers by keeping your message professional and relevant to your audience.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="mt-10">
              <button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="w-full bg-gradient-to-r from-red-600 to-pink-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl hover:from-red-700 hover:to-pink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {serviceType === "brevo" && brevoMode === "campaign" ? "Creating Campaign..." : "Sending Emails..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {serviceType === "brevo" && brevoMode === "campaign" ? "Create Email Campaign" : "Send Email Campaign"}
                  </span>
                )}
              </button>
            </div>

            {/* Status */}
            {status && (
              <div className={`mt-6 p-5 rounded-xl border-2 ${status.includes("✅") ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} transition-all duration-300`}>
                <p className={`font-semibold ${status.includes("✅") ? "text-emerald-800" : "text-red-800"}`}>{status}</p>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-7 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-5 text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Delivery Report
                </h3>
                <div className="space-y-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-gray-800">{r.to}</span>
                        <span className={`text-xs font-bold px-4 py-1.5 rounded-full ${r.status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Layout
GmailSender.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

// Protect and preserve layout
const ProtectedGmailSender = withClinicAuth(GmailSender);
ProtectedGmailSender.getLayout = GmailSender.getLayout;

export default ProtectedGmailSender;