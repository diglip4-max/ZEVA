import React, { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { useRouter } from "next/router";

export default function DemoQuickPopup() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (router.pathname === "/clinic-management-software-uae") {
      setOpen(true);
      setModal(false);
    }
    const handler = () => {
      setOpen(true);
      setModal(true);
    };
    window.addEventListener("zeva:open-demo-popup", handler as EventListener);
    return () => window.removeEventListener("zeva:open-demo-popup", handler as EventListener);
  }, [router.pathname]);

  if (!open) return null;

  if (modal) {
    const handleSendEmail = () => {
      const subject = encodeURIComponent("Inquiry from Website");
      const body = encodeURIComponent(
        `Hello Zeva Team,\n\nI would like to learn more about your clinic management platform.\n\nThanks,\n${name || "[Your Name]"}\nEmail: ${email || ""}\nPhone: ${phone || ""}`
      );
      window.location.href = `mailto:hello@zeva.ae?subject=${subject}&body=${body}`;
    };
    return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative w-[560px] max-w-[92vw] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
        <div className="bg-[#0A1F44] text-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
              <div className="font-bold">Book Your Demo</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-1 text-[13px] text-blue-200">
            See Zeva in action. Schedule your personalized demo today.
          </div>
        </div>
        <div className="px-6 py-5">
          <form className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@clinic.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+971 XX XXX XXXX"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F0D98C] text-[#0A1F44] font-semibold px-4 py-2"
            >
              <Send className="w-4 h-4" />
              Request Demo
            </button>
          </form>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSendEmail}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 text-[#0A1F44] font-semibold px-4 py-2"
            >
              Send via Email
            </button>
          </div>
          <div className="mt-3 text-center text-[11px] text-gray-500">
            We'll contact you within 24 hours
          </div>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[90vw]">
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
        <div className="bg-[#0A1F44] text-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
              <div className="font-bold">Book Your Demo</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-1 text-[13px] text-blue-200">
            See Zeva in action. Schedule your personalized demo today.
          </div>
        </div>
        <div className="px-5 py-4">
          <form className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">Email Address</label>
              <input
                type="email"
                placeholder="you@clinic.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A1F44] mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+971 XX XXX XXXX"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F0D98C] text-[#0A1F44] font-semibold px-4 py-2"
            >
              <Send className="w-4 h-4" />
              Request Demo
            </button>
          </form>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                const subject = encodeURIComponent("Inquiry from Website");
                const body = encodeURIComponent(
                  `Hello Zeva Team,\n\nI would like to learn more about your clinic management platform.\n\nThanks,\n${name || "[Your Name]"}\nEmail: ${email || ""}\nPhone: ${phone || ""}`
                );
                window.location.href = `mailto:hello@zeva.ae?subject=${subject}&body=${body}`;
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 text-[#0A1F44] font-semibold px-4 py-2"
            >
              Send via Email
            </button>
          </div>
          <div className="mt-3 text-center text-[11px] text-gray-500">We'll contact you within 24 hours</div>
        </div>
      </div>
    </div>
  );
}

