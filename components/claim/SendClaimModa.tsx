import React, { useState } from "react";

type ClaimMethod = "whatsapp";

interface SendClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend?: (data: { method: ClaimMethod }) => void;
  isLoading?: boolean;
}

const SendClaimModal: React.FC<SendClaimModalProps> = ({
  isOpen,
  onClose,
  onSend,
  isLoading = false,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<ClaimMethod>("whatsapp");

  if (!isOpen) return null;

  const handleSend = () => {
    if (isLoading) return;

    onSend?.({
      method: selectedMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-claim-title"
        className="
          relative w-full max-w-[620px]
          overflow-hidden rounded-[24px]
          border border-white/80
          bg-white
          shadow-[0_25px_80px_rgba(15,23,42,0.22)]
          animate-in fade-in zoom-in-95 duration-200
        "
      >
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="relative overflow-hidden border-b border-slate-100">
          {/* Decorative background */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-100/50 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -top-24 h-40 w-40 rounded-full bg-teal-100/30 blur-3xl" />

          <div className="relative flex items-start justify-between px-7 py-6">
            <div className="flex items-center gap-4">
              {/* Header Icon */}
              <div
                className="
                  relative flex h-12 w-12 shrink-0 items-center justify-center
                  rounded-[15px]
                  bg-gradient-to-br from-emerald-500 to-green-600
                  text-white
                  shadow-[0_8px_20px_rgba(16,185,129,0.25)]
                "
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.5 11.5a8.5 8.5 0 01-12.35 7.56L4 20l1.18-4.08A8.5 8.5 0 1120.5 11.5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.6 9.5c.3 1.55 1.45 2.85 3 3.55"
                  />
                </svg>

                {/* Small shine */}
                <span className="absolute inset-0 rounded-[15px] bg-white/10" />
              </div>

              <div>
                <h2
                  id="send-claim-title"
                  className="text-[19px] font-bold tracking-[-0.02em] text-slate-900"
                >
                  Send Claim
                </h2>

                <p className="mt-1 text-[13px] leading-5 text-slate-500">
                  Choose how you'd like to deliver this claim.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              aria-label="Close modal"
              className="
                flex h-9 w-9 shrink-0 items-center justify-center
                rounded-xl
                border border-transparent
                text-slate-400
                transition-all duration-200
                hover:border-slate-200
                hover:bg-slate-50
                hover:text-slate-700
                active:scale-95
                disabled:pointer-events-none
                disabled:opacity-50
              "
            >
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* =====================================================
            BODY
        ====================================================== */}
        <div className="px-7 py-7">
          {/* Section Heading */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">
                  Delivery channel
                </p>

                <p className="mt-1 text-[12px] text-slate-500">
                  Select a channel to send the claim.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                1 option available
              </span>
            </div>
          </div>

          {/* Channel Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* =================================================
                WHATSAPP
            ================================================== */}
            <button
              type="button"
              onClick={() => setSelectedMethod("whatsapp")}
              disabled={isLoading}
              aria-pressed={selectedMethod === "whatsapp"}
              className={`
                group relative overflow-hidden rounded-2xl
                border p-5 text-left
                transition-all duration-300
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-emerald-500
                focus-visible:ring-offset-2
                ${
                  selectedMethod === "whatsapp"
                    ? `
                      border-emerald-400
                      bg-gradient-to-br
                      from-emerald-50
                      via-white
                      to-green-50
                      shadow-[0_10px_30px_rgba(16,185,129,0.12)]
                    `
                    : `
                      border-slate-200
                      bg-white
                      hover:border-emerald-200
                      hover:shadow-[0_8px_25px_rgba(15,23,42,0.06)]
                    `
                }
                disabled:pointer-events-none
                disabled:opacity-60
              `}
            >
              {/* Selected Glow */}
              {selectedMethod === "whatsapp" && (
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl" />
              )}

              {/* Radio / Check */}
              <div
                className={`
                  absolute right-4 top-4
                  flex h-5 w-5 items-center justify-center
                  rounded-full border
                  transition-all duration-200
                  ${
                    selectedMethod === "whatsapp"
                      ? "border-emerald-500 bg-emerald-500 shadow-sm"
                      : "border-slate-300 bg-white"
                  }
                `}
              >
                {selectedMethod === "whatsapp" && (
                  <svg
                    className="h-3 w-3 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12.5l4.5 4L19 7"
                    />
                  </svg>
                )}
              </div>

              <div className="relative">
                {/* Icon */}
                <div
                  className={`
                    mb-4 flex h-12 w-12 items-center justify-center
                    rounded-[14px]
                    transition-all duration-300
                    ${
                      selectedMethod === "whatsapp"
                        ? `
                          bg-emerald-500
                          text-white
                          shadow-[0_8px_20px_rgba(16,185,129,0.25)]
                        `
                        : `
                          bg-slate-100
                          text-slate-500
                          group-hover:bg-emerald-50
                          group-hover:text-emerald-600
                        `
                    }
                  `}
                >
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.5 11.5a8.5 8.5 0 01-12.35 7.56L4 20l1.18-4.08A8.5 8.5 0 1120.5 11.5z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.6 9.5c.3 1.55 1.45 2.85 3 3.55"
                    />
                  </svg>
                </div>

                <p className="text-[15px] font-bold text-slate-900">WhatsApp</p>

                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  Deliver the claim directly to the recipient's WhatsApp.
                </p>

                {/* Status */}
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-2.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700">
                    Available
                  </span>
                </div>
              </div>
            </button>

            {/* =================================================
                EMAIL
            ================================================== */}
            <div
              aria-disabled="true"
              className="
                relative overflow-hidden
                cursor-not-allowed
                rounded-2xl
                border border-slate-200
                bg-gradient-to-br from-slate-50 to-white
                p-5
              "
            >
              {/* Coming Soon Badge */}
              <span
                className="
                  absolute right-4 top-4
                  rounded-full
                  border border-amber-200
                  bg-amber-50
                  px-2.5 py-1
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-amber-700
                "
              >
                Coming Soon
              </span>

              <div className="opacity-65">
                {/* Icon */}
                <div
                  className="
                    mb-4 flex h-12 w-12 items-center justify-center
                    rounded-[14px]
                    bg-slate-100
                    text-slate-400
                  "
                >
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.5 7l8.5 6 8.5-6"
                    />
                  </svg>
                </div>

                <p className="text-[15px] font-bold text-slate-700">Email</p>

                <p className="mt-1 text-[12px] leading-5 text-slate-400">
                  Send the claim directly to the recipient's email.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Not available
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div
            className="
              mt-5 flex items-start gap-3
              rounded-2xl
              border border-slate-200
              bg-slate-50/80
              px-4 py-3.5
            "
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <svg
                className="h-3.5 w-3.5 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 10v5M12 7.5v.01" />
              </svg>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-slate-700">
                Ready to send
              </p>

              <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                Your claim will be prepared and delivered securely using
                WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            FOOTER
        ====================================================== */}
        <div
          className="
            flex items-center justify-between
            border-t border-slate-100
            bg-slate-50/60
            px-7 py-5
          "
        >
          {/* Left helper */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <svg
                className="h-3.5 w-3.5 text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12.5l4 4L19 7"
                />
              </svg>
            </div>

            <span className="text-[11px] font-medium text-slate-500">
              WhatsApp selected
            </span>
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-3">
            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="
                rounded-xl
                border border-slate-200
                bg-white
                px-5 py-2.5
                text-[13px]
                font-semibold
                text-slate-600
                shadow-sm
                transition-all duration-200
                hover:border-slate-300
                hover:bg-slate-50
                hover:text-slate-800
                active:scale-[0.98]
                disabled:pointer-events-none
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            {/* Send Claim */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading}
              className="
                group
                inline-flex min-w-[145px]
                items-center justify-center gap-2
                rounded-xl
                bg-gradient-to-r from-emerald-500 to-green-600
                px-5 py-2.5
                text-[13px]
                font-bold
                text-white
                shadow-[0_8px_20px_rgba(16,185,129,0.28)]
                transition-all duration-200
                hover:-translate-y-[1px]
                hover:from-emerald-600
                hover:to-green-700
                hover:shadow-[0_12px_25px_rgba(16,185,129,0.34)]
                active:translate-y-0
                active:scale-[0.98]
                disabled:pointer-events-none
                disabled:opacity-60
                disabled:shadow-none
              "
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />

                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                    />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M22 2L11 13"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M22 2l-7 20-4-9-9-4 20-7z"
                    />
                  </svg>
                  Send Claim
                  <svg
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12h14M13 6l6 6-6 6"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendClaimModal;
