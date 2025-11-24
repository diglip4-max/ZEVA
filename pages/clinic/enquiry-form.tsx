'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  MapPin,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  MessageSquare,
  Home,
} from 'lucide-react';

function EnquiryFormPage() {
  const searchParams = useSearchParams();
  // const router = useRouter();
  const clinicId = searchParams.get('clinicId');
  const clinicName = searchParams.get('clinicName');
  const clinicAddress = searchParams.get('clinicAddress');

  interface ClinicDetails {
    timings?: string;
    pricing?: string;
    [key: string]: unknown;
  }

  const [clinicDetails, setClinicDetails] = useState<ClinicDetails | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (clinicId) {
      axios
        .get<{ clinic: ClinicDetails }>(`/api/clinics/${clinicId}`)
        .then((res) => setClinicDetails(res.data.clinic))
        .catch((err) => console.error(err));
    }
  }, [clinicId]);

  // Handle name input - only allow letters and spaces
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const namePattern = /^[a-zA-Z\s]*$/;
    if (namePattern.test(value)) {
      setFormData({ ...formData, name: value });
    }
  };

  // Handle phone input - only allow numbers
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const phonePattern = /^[0-9]*$/;
    if (phonePattern.test(value)) {
      setFormData({ ...formData, phone: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/clinics/enquiry',
        { ...formData, clinicId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setSubmitted(true);
    } catch {
      alert('Failed to send enquiry');
    }
  };

  const goToClinicPage = () => {
    if (clinicId) {
      window.location.href = `/clinics/${clinicId}`;
    } else {
      window.location.href = '/';
    }
  };

  if (!clinicDetails) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[200px]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div
              className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin mx-auto"
              style={{
                borderTopColor: '#2D9AA5',
                borderRightColor: '#2D9AA5',
              }}
            ></div>
            <div
              className="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-pulse mx-auto"
              style={{
                borderTopColor: 'rgba(45, 154, 165, 0.3)',
              }}
            ></div>
          </div>
          <div className="space-y-2">
            <p
              className="text-lg font-medium animate-pulse"
              style={{ color: '#2D9AA5' }}
            >
              Loading clinic information...
            </p>
            <p className="text-sm text-gray-500">
              Please wait while we fetch the details
            </p>
          </div>
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  backgroundColor: '#2D9AA5',
                  animationDelay: `${i * 0.1}s`,
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid lg:grid-cols-2 min-h-[600px]">
            {/* Left Side */}
            <div
              className="text-white p-4 sm:p-6 lg:p-12 flex flex-col justify-center"
              style={{
                background: 'linear-gradient(to bottom right, #2D9AA5, #228B8D)',
              }}
            >
              <div className="space-y-6 sm:space-y-8">
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
                    {clinicName}
                  </h1>
                  <div className="flex items-start space-x-3 mb-4 sm:mb-6">
                    <MapPin
                      className="w-4 h-4 sm:w-5 sm:h-5 mt-1 flex-shrink-0"
                      style={{ color: '#A7F3D0' }}
                    />
                    <p
                      className="text-sm sm:text-base lg:text-lg"
                      style={{ color: '#A7F3D0' }}
                    >
                      {clinicAddress}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Clock
                      className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                      style={{ color: '#A7F3D0' }}
                    />
                    <div className="min-w-0">
                      <p
                        className="font-semibold text-sm sm:text-base"
                        style={{ color: '#A7F3D0' }}
                      >
                        Operating Hours
                      </p>
                      <p className="text-white text-sm sm:text-base break-words">
                        {clinicDetails.timings}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                    <DollarSign
                      className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
                      style={{ color: '#A7F3D0' }}
                    />
                    <div className="min-w-0">
                      <p
                        className="font-semibold text-sm sm:text-base"
                        style={{ color: '#A7F3D0' }}
                      >
                        Consultation Fees
                      </p>
                      <p className="text-white text-sm sm:text-base break-words">
                        {clinicDetails.pricing}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 sm:pt-4">
                  <p
                    className="text-sm sm:text-base lg:text-lg"
                    style={{ color: '#A7F3D0' }}
                  >
                    Ready to book your appointment? Fill out the form and
                    we&apos;ll get back to you shortly.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="p-4 sm:p-6 lg:p-12 flex flex-col justify-center">
              {submitted ? (
                <div className="text-center space-y-4">
                  <div
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: '#D1FAE5' }}
                  >
                    <svg
                      className="w-6 h-6 sm:w-8 sm:h-8"
                      style={{ color: '#059669' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                    Thank You!
                  </h2>
                  <p className="text-gray-600 text-base sm:text-lg px-4">
                    Your enquiry has been sent successfully. We&apos;ll contact
                    you soon.
                  </p>
                  <button
                    onClick={goToClinicPage}
                    className="mt-6 flex items-center justify-center space-x-2 text-white py-3 px-4 sm:px-6 rounded-xl font-semibold transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl mx-auto text-sm sm:text-base"
                    style={{
                      background:
                        'linear-gradient(to right, #2D9AA5, #228B8D)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'linear-gradient(to right, #236B73, #1A6B6B)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'linear-gradient(to right, #2D9AA5, #228B8D)';
                    }}
                  >
                    <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Go to Clinic Page</span>
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                    Send Enquiry
                  </h2>
                  <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
                    Get in touch with us for appointments and consultations
                  </p>
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-4 sm:space-y-6"
                  >
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="text"
                        placeholder="Your Full Name"
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-200 rounded-xl transition-all duration-200 text-gray-700 text-sm sm:text-base"
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          input.style.outline = 'none';
                          input.style.borderColor = '#2D9AA5';
                          input.style.boxShadow =
                            '0 0 0 2px rgba(45, 154, 165, 0.2)';
                        }}
                        onBlur={(e) => {
                          const input = e.currentTarget;
                          input.style.borderColor = '#E5E7EB';
                          input.style.boxShadow = 'none';
                        }}
                        value={formData.name}
                        onChange={handleNameChange}
                        required
                      />
                    </div>

                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        placeholder="Email Address"
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-200 rounded-xl transition-all duration-200 text-gray-700 text-sm sm:text-base"
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          input.style.outline = 'none';
                          input.style.borderColor = '#2D9AA5';
                          input.style.boxShadow =
                            '0 0 0 2px rgba(45, 154, 165, 0.2)';
                        }}
                        onBlur={(e) => {
                          const input = e.currentTarget;
                          input.style.borderColor = '#E5E7EB';
                          input.style.boxShadow = 'none';
                        }}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-200 rounded-xl transition-all duration-200 text-gray-700 text-sm sm:text-base"
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          input.style.outline = 'none';
                          input.style.borderColor = '#2D9AA5';
                          input.style.boxShadow =
                            '0 0 0 2px rgba(45, 154, 165, 0.2)';
                        }}
                        onBlur={(e) => {
                          const input = e.currentTarget;
                          input.style.borderColor = '#E5E7EB';
                          input.style.boxShadow = 'none';
                        }}
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        required
                      />
                    </div>

                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-4 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <textarea
                        placeholder="Your Message"
                        rows={4}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-200 rounded-xl transition-all duration-200 text-gray-700 resize-none text-sm sm:text-base"
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          input.style.outline = 'none';
                          input.style.borderColor = '#2D9AA5';
                          input.style.boxShadow =
                            '0 0 0 2px rgba(45, 154, 165, 0.2)';
                        }}
                        onBlur={(e) => {
                          const input = e.currentTarget;
                          input.style.borderColor = '#E5E7EB';
                          input.style.boxShadow = 'none';
                        }}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-semibold text-base sm:text-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                      style={{
                        background:
                          'linear-gradient(to right, #2D9AA5, #228B8D)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'linear-gradient(to right, #236B73, #1A6B6B)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'linear-gradient(to right, #2D9AA5, #228B8D)';
                      }}
                    >
                      Send Enquiry
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnquiryFormPage;

EnquiryFormPage.getLayout = function PageLayout(page: React.ReactNode) {
  return page;
};
