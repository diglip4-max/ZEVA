import React from "react";
import Head from "next/head";

const ConsentSuccessPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Consent Submitted | Zeva360</title>
        <meta name="description" content="Your consent form has been submitted successfully" />
      </Head>

      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-8 px-4">
        <div className="max-w-md w-full">

          {/* ── Document Container ── */}
          <div className="bg-white shadow-xl border border-gray-200 rounded-sm overflow-hidden">

            {/* ── Top Accent Bar ── */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600" />

            {/* ── Content ── */}
            <div className="px-8 py-10 text-center">

              {/* Success Icon */}
              <div className="relative mx-auto mb-5 w-16 h-16">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20" />
                <div className="relative w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-lg font-bold text-gray-900 mb-1.5 tracking-tight">
                Consent Submitted
              </h1>
              <p className="text-xs text-gray-500 mb-6">
                Your consent form has been recorded successfully.
              </p>

              {/* Divider */}
              <div className="border-t border-dashed border-gray-200 my-5" />

              {/* Info */}
              <p className="text-[11px] text-gray-600 leading-relaxed mb-5">
                A copy of your consent form has been saved to your medical records and is available for download at any time.
              </p>

              {/* What Happens Next */}
              <div className="text-left bg-gray-50 border border-gray-200 rounded-md p-4 mb-5">
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wide mb-2.5">What happens next?</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-gray-600 leading-relaxed">Our medical team will review your consent</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-gray-600 leading-relaxed">You'll receive a confirmation via WhatsApp or SMS</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-gray-600 leading-relaxed">The consent will be available in your patient portal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-gray-600 leading-relaxed">You can access it anytime before your appointment</span>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <p className="text-[10px] text-gray-400">
                Questions? Contact our support team for assistance.
              </p>
            </div>

            {/* ── Footer Bar ── */}
            <div className="px-8 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-center text-[10px] text-gray-400">
                Powered by <span className="font-semibold text-slate-600">Zeva360</span> Healthcare
              </p>
            </div>

          </div>
          {/* ── End Document Container ── */}

        </div>
      </div>
    </>
  );
};

export default ConsentSuccessPage;
