import { Search, UserPlus, Calculator, MapPin, Video, FileText, Briefcase, BookOpen } from 'lucide-react';

export default function WhyChooseZeva() {
  const features = [
    {
      icon: Search,
      title: "Find Providers",
      description: "Discover qualified doctors and trusted clinics with advanced filtering and verification.",
      iconBg: "from-violet-500 to-purple-600"
    },
    {
      icon: UserPlus,
      title: "Quick Registration",
      description: "Seamless onboarding for medical professionals with credential verification.",
      iconBg: "from-blue-500 to-cyan-600"
    },
    {
      icon: Calculator,
      title: "Health Tools",
      description: "Evidence-based calculators for BMI, nutrition, and comprehensive health metrics.",
      iconBg: "from-emerald-500 to-teal-600"
    },
    {
      icon: MapPin,
      title: "Location Search",
      description: "Real-time mapping of hospitals, pharmacies, and emergency medical services.",
      iconBg: "from-indigo-500 to-blue-600"
    },
    {
      icon: Video,
      title: "Telemedicine",
      description: "HIPAA-compliant video consultations with board-certified physicians.",
      iconBg: "from-rose-500 to-pink-600"
    },
    {
      icon: FileText,
      title: "Digital Records",
      description: "Encrypted medical records management with instant access and sharing.",
      iconBg: "from-amber-500 to-orange-600"
    },
    {
      icon: Briefcase,
      title: "Career Hub",
      description: "Curated medical positions and healthcare career opportunities nationwide.",
      iconBg: "from-purple-500 to-fuchsia-600"
    },
    {
      icon: BookOpen,
      title: "Knowledge Hub",
      description: "Peer-reviewed health articles and evidence-based medical insights.",
      iconBg: "from-sky-500 to-blue-600"
    }
  ];

  return (
    <div className="py-20 px-4 bg-gray-50">
      <div className="text-center mb-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Why Choose ZEVA
        </h2>
        <p className="text-base md:text-lg text-gray-600 leading-relaxed">
          Experience the future of healthcare with our integrated platform, combining cutting-edge technology with patient-centered care for comprehensive medical solutions.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 max-w-7xl mx-auto">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={index}
              className="relative bg-white rounded-2xl p-8 transition-all duration-300 border border-gray-100 group hover:shadow-lg"
            >
              {/* Icon */}
              <div className="relative mb-6 w-16 h-16 group-hover:scale-105 transition-transform duration-300">
                <div 
                  className={`w-full h-full bg-gradient-to-br ${feature.iconBg} rounded-2xl flex items-center justify-center shadow-sm`}
                >
                  <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group relative px-8 py-3 bg-violet-600 text-white font-semibold text-base rounded-lg transition-all duration-300 hover:bg-violet-700 hover:shadow-md active:scale-95"
        >
          <span className="flex items-center gap-2">
            Get Started with ZEVA
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}