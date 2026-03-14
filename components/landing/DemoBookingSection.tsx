import React from "react";
import { FileText, Users, ShieldCheck, Clock, Send } from "lucide-react";

export default function DemoBookingSection() {
  const bullets = [
    { icon: FileText, text: "See Zeva in action with your clinic’s workflow" },
    { icon: Clock, text: "30-minute personalized demo session" },
    { icon: ShieldCheck, text: "Dedicated onboarding specialist" },
    { icon: Users, text: "No commitment required" },
  ];

  return (
    <section
      className="w-full py-20"
      style={{
        background:
          "radial-gradient(1000px 600px at 15% 20%, rgba(238,242,247,0.9), transparent 55%), radial-gradient(900px 500px at 85% 30%, rgba(238,242,247,0.7), transparent 60%), #ffffff",
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-10">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border text-xs shadow-sm bg-[#F5E9C9] border-[#E8D9B6] text-[#0b2b4a]">
              <span className="w-2 h-2 rounded-full bg-[#E2BE4C]" />
              <span className="font-semibold">Limited Slots Available</span>
            </div>
            <h2 className="mt-5 text-3xl md:text-4xl font-extrabold tracking-wide">
              <span className="text-[#0b2b4a]">See How Zeva Can </span>
              <span className=" bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F0D98C]  bg-clip-text text-transparent">
              
                Transform Your Clinic
              </span>
            </h2>
            <p className="mt-3 text-sm md:text-base text-gray-700">
              Book a free personalized demo and discover how top Dubai clinics are
              scaling their operations, increasing revenue, and delighting patients
              with Zeva.
            </p>

            <div className="mt-6 space-y-4">
              {bullets.map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-[10px] flex-shrink-0"
                    style={{ backgroundColor: "#0b2b4a" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#f5ca3a" }} />
                  </div>
                  <div className="text-sm text-gray-800">{text}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-4 p-6 bg-white rounded-2xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center -space-x-3">
                {["A", "B", "C", "D"].map((a) => (
                  <div
                    key={a}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F0D98C] ring-2 ring-white text-[#0A1F44] font-bold text-xs"
                  >
                    {a}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm font-bold text-[#0b2b4a]">Join 500+ clinics</div>
                <div className="text-[11px] text-gray-600">who chose Zeva this month</div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="relative rounded-3xl bg-white p-7 shadow-2xl border-2 border-gray-200">
              <div className="absolute top-0 right-0 w-40 h-40 md:w-56 md:h-56 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-bl-full pointer-events-none" />
              <div className="text-lg font-semibold text-[#0b2b4a]">Book Your Free Demo</div>
              <div className="mt-1 text-xs text-gray-600">
                Fill out the form below and we’ll contact you within 2 hours.
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#0b2b4a] mb-2">Full Name *</div>
                  <input
                    type="text"
                    placeholder="Dr. Ahmed Hassan"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0b2b4a] mb-2">Email Address *</div>
                  <input
                    type="email"
                    placeholder="you@yourclinic.com"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0b2b4a] mb-2">Phone Number *</div>
                  <input
                    type="tel"
                    placeholder="+971 XX XXX XXXX"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onInput={(e) => {
                      const target = e.currentTarget as HTMLInputElement;
                      target.value = target.value.replace(/\D/g, "");
                    }}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0b2b4a] mb-2">Clinic Name *</div>
                  <input
                    type="text"
                    placeholder="Your Clinic Name"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </div>
              </div>
              <a
                href=""
                className="mt-5 inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-primary/90 rounded-md px-6 has-[>svg]:px-4 w-full bg-gradient-to-r from-[#D4AF37] to-[#F0D98C] text-[#0A1F44] hover:shadow-2xl hover:shadow-[#D4AF37]/30 transition-all duration-300 h-14 text-lg font-bold"
              >
                <Send className="w-4 h-4" />
                Book My Free Demo Now
              </a>
              <p className="mt-3 text-xs text-gray-500 text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy. We will only contact you about your demo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
