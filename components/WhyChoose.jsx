import { Search, UserPlus, Calculator, MapPin, Video, FileText, Briefcase, BookOpen, Shield, Clock, Star, Users } from 'lucide-react';

export default function WhyChooseZeva() {
  const features = [
    {
      icon: Search,
      title: "Find Providers",
      description: "Advanced search with filters for doctors, clinics, specialties, ratings, and location-based results.",
      iconBg: "from-violet-500 to-purple-600",
      stats: "10,000+ Providers"
    },
    {
      icon: Shield,
      title: "Verified Professionals",
      description: "All doctors and clinics are verified with credentials, certifications, and background checks.",
      iconBg: "from-blue-500 to-cyan-600",
      stats: "100% Verified"
    },
    {
      icon: Calculator,
      title: "Health Calculators",
      description: "BMI, BMR, TDEE, pregnancy tracker, depression test, calorie counter, and 8+ health tools.",
      iconBg: "from-emerald-500 to-teal-600",
      stats: "8+ Tools"
    },
    {
      icon: MapPin,
      title: "Location Services",
      description: "Find nearby hospitals, pharmacies, emergency services with real-time mapping and directions.",
      iconBg: "from-indigo-500 to-blue-600",
      stats: "GPS Enabled"
    },
    {
      icon: Video,
      title: "Telemedicine",
      description: "Secure video consultations with board-certified physicians. HIPAA-compliant platform.",
      iconBg: "from-rose-500 to-pink-600",
      stats: "24/7 Available"
    },
    {
      icon: FileText,
      title: "Digital Records",
      description: "Encrypted medical records, prescriptions, lab results with instant access and sharing.",
      iconBg: "from-amber-500 to-orange-600",
      stats: "Secure Storage"
    },
    {
      icon: Briefcase,
      title: "Career Hub",
      description: "Medical job listings, career opportunities, and professional networking for healthcare workers.",
      iconBg: "from-purple-500 to-fuchsia-600",
      stats: "500+ Jobs"
    },
    {
      icon: BookOpen,
      title: "Health Knowledge",
      description: "Evidence-based articles, health blogs, treatment guides, and Ayurveda insights.",
      iconBg: "from-sky-500 to-blue-600",
      stats: "1000+ Articles"
    },
    {
      icon: Star,
      title: "Patient Reviews",
      description: "Real patient reviews and ratings help you make informed healthcare decisions.",
      iconBg: "from-yellow-500 to-orange-600",
      stats: "50K+ Reviews"
    },
    {
      icon: Clock,
      title: "Quick Appointments",
      description: "Book appointments instantly, view availability, and manage your healthcare schedule easily.",
      iconBg: "from-green-500 to-emerald-600",
      stats: "Instant Booking"
    },
    {
      icon: Users,
      title: "Community Support",
      description: "Connect with patients, share experiences, and get support from healthcare community.",
      iconBg: "from-pink-500 to-rose-600",
      stats: "Active Community"
    },
    {
      icon: UserPlus,
      title: "Easy Registration",
      description: "Quick onboarding for doctors and clinics with streamlined credential verification process.",
      iconBg: "from-cyan-500 to-blue-600",
      stats: "5 Min Setup"
    }
  ];

  return (
    <div className="py-12 sm:py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Why Choose ZEVA
          </h2>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your comprehensive healthcare platform combining verified providers, advanced tools, and seamless services for better health outcomes.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mb-10">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-lg p-4 sm:p-5 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-md group"
              >
                {/* Icon */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.iconBg} rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  {feature.stats && (
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                      {feature.stats}
                    </span>
                  )}
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-gray-900 mb-2 leading-tight">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-10">
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">10K+</div>
            <div className="text-xs sm:text-sm text-gray-600">Healthcare Providers</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">50K+</div>
            <div className="text-xs sm:text-sm text-gray-600">Patient Reviews</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">100%</div>
            <div className="text-xs sm:text-sm text-gray-600">Verified Professionals</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">24/7</div>
            <div className="text-xs sm:text-sm text-gray-600">Available Support</div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group relative px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-900 text-white font-semibold text-sm sm:text-base rounded-lg transition-all duration-200 hover:bg-gray-800 hover:shadow-lg active:scale-95"
          >
            <span className="flex items-center justify-center gap-2">
              Get Started with ZEVA
              <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}