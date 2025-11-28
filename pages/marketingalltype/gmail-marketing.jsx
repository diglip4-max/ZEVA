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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Compact Header */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-600">Gmail Marketing</p>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">Email Campaign Broadcast</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Create and send professional email campaigns to your customers</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-red-700">Email Ready</span>
              </span>
            </div>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-red-500 via-red-600 to-red-500 rounded-full mt-3"></div>
        </section>

        {/* Compact Main Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Compact Service Type Toggle */}
          <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-3 space-y-3">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Email Service</label>
              <div className="inline-flex rounded-lg bg-white shadow-sm border border-gray-200 p-1">
                <button
                  className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                    serviceType === "gmail"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setServiceType("gmail")}
                >
                  Gmail
                </button>
                <button
                  className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                    serviceType === "brevo"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setServiceType("brevo")}
                >
                  Brevo Campaign
                </button>
              </div>
            </div>
            
            {/* Compact Brevo Mode Toggle */}
            {serviceType === "brevo" && (
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Brevo Mode</label>
                <div className="inline-flex rounded-lg bg-white shadow-sm border border-gray-200 p-1">
                  <button
                    className={`px-3 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                      brevoMode === "transactional"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setBrevoMode("transactional")}
                  >
                    Transactional
                  </button>
                  <button
                    className={`px-3 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                      brevoMode === "campaign"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setBrevoMode("campaign")}
                  >
                    Scheduled
                  </button>
                </div>
              </div>
            )}
            
            {/* Compact Recipient Mode Toggle */}
            {(serviceType === "gmail" || (serviceType === "brevo" && brevoMode === "transactional")) && (
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Recipient Type</label>
                <div className="inline-flex rounded-lg bg-white shadow-sm border border-gray-200 p-1">
                  <button
                    className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                      mode === "single"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("single")}
                  >
                    Single Recipient
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm transition-all duration-200 ${
                      mode === "bulk"
                        ? "bg-red-600 text-white shadow-sm"
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

          {/* Compact Form */}
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Brevo Campaign Name */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                      Campaign Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Monthly Newsletter - December 2024"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                )}

                {/* Recipient Emails */}
                {(serviceType === "gmail" || (serviceType === "brevo" && brevoMode === "transactional")) && (
                  mode === "single" ? (
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Recipient Email</label>
                      <input
                        type="email"
                        placeholder="example@gmail.com"
                        value={singleEmail}
                        onChange={(e) => setSingleEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                        Recipient Emails <span className="text-gray-500 font-normal">(comma separated)</span>
                      </label>
                      <textarea
                        placeholder="example1@gmail.com, example2@gmail.com"
                        value={bulkEmails}
                        onChange={(e) => setBulkEmails(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all resize-none text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                        rows={4}
                      />
                      {bulkEmails && (
                        <p className="text-xs text-gray-600 mt-1">
                          {bulkEmails.split(",").filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())).length} valid email(s) detected
                        </p>
                      )}
                    </div>
                  )
                )}

                {/* Brevo List IDs */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                      Contact List IDs <span className="text-gray-500 font-normal">(comma separated, optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2, 7"
                      value={listIds}
                      onChange={(e) => setListIds(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Enter the list IDs from your Brevo account</p>
                  </div>
                )}

                {/* Sender Info (for Brevo) */}
                {serviceType === "brevo" && (
                  <>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                        Sender Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Ayurveda Clinic"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                        Sender Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g., noreply@ayurvedaclinic.com"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Must be a verified sender in your Brevo account</p>
                    </div>
                  </>
                )}

                {/* Scheduled Date */}
                {serviceType === "brevo" && brevoMode === "campaign" && (
                  <div>
                    <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                      Schedule Date & Time <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => {
                        const date = new Date(e.target.value);
                        const formatted = date.toISOString().slice(0, 19).replace('T', ' ');
                        setScheduledAt(formatted);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Leave empty to send immediately</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Email Subject</label>
                  <input
                    type="text"
                    placeholder="e.g., Special Summer Discount"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Email Body</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
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
                      className="h-32 sm:h-40"
                    />
                  </div>
                  {serviceType === "brevo" && (
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">HTML formatting is supported for Brevo campaigns</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Email Image</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 sm:p-6 hover:border-red-400 transition-colors bg-gray-50">
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
                          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                            {uploading ? "Uploading..." : "Click to upload image"}
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-600">PNG, JPG up to 10MB</span>
                        </>
                      ) : (
                        <div className="relative w-full">
                          <img src={imageUrl} alt="Uploaded" className="w-full h-48 sm:h-64 object-cover rounded-lg border border-gray-200 shadow-sm" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setImageUrl("");
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
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

                <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Best Practices</h4>
                      <p className="text-[10px] sm:text-xs text-gray-700 leading-relaxed">
                        Use a clear subject line, personalize your message, and include a strong call-to-action for better engagement.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Delivery Tip</h4>
                      <p className="text-[10px] sm:text-xs text-gray-700 leading-relaxed">
                        Avoid spam triggers by keeping your message professional and relevant to your audience.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Action */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="w-full bg-red-600 text-white font-medium py-3 rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs sm:text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {serviceType === "brevo" && brevoMode === "campaign" ? "Creating Campaign..." : "Sending Emails..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {serviceType === "brevo" && brevoMode === "campaign" ? "Create Email Campaign" : "Send Email Campaign"}
                  </span>
                )}
              </button>
            </div>

            {/* Compact Status */}
            {status && (
              <div className={`mt-4 p-3 rounded-lg border ${status.includes("✅") ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} transition-all duration-300`}>
                <p className={`text-xs sm:text-sm font-medium ${status.includes("✅") ? "text-green-800" : "text-red-800"}`}>{status}</p>
              </div>
            )}

            {/* Compact Results */}
            {results.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4">
                <h3 className="font-bold text-gray-900 mb-3 text-sm sm:text-base flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Delivery Report
                </h3>
                <div className="space-y-2">
                  {results.map((r, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs sm:text-sm font-semibold text-gray-800">{r.to}</span>
                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${r.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
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
GmailSender.getLayout = function PageLayout(page) {
  // Wrap page in ClinicLayout for persistent layout
  // When getLayout is used, Next.js keeps the layout mounted and only swaps page content
  // This prevents sidebar and header from re-rendering on navigation
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Protect and preserve layout
const ProtectedGmailSender = withClinicAuth(GmailSender);
ProtectedGmailSender.getLayout = GmailSender.getLayout;

export default ProtectedGmailSender;