import React, { useState, useEffect } from 'react';
import Link from 'next/link';


const formatCount = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";

    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1) + 'M';
    } else if (num >= 1_000) {
        return (num / 1_000).toFixed(1) + 'K';
    } else {
        return num.toString();
    }
};

// Toast Component
const Toast = ({ message, type, isVisible, onClose }) => {
  if (!isVisible) return null;

  const getToastStyles = () => {
    const baseStyles = "fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl backdrop-blur-md border transform transition-all duration-500 ease-in-out max-w-md";

    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-500/20 border-green-400/30 text-green-100`;
      case 'error':
        return `${baseStyles} bg-red-500/20 border-red-400/30 text-red-100`;
      case 'warning':
        return `${baseStyles} bg-yellow-500/20 border-yellow-400/30 text-yellow-100`;
      default:
        return `${baseStyles} bg-blue-500/20 border-blue-400/30 text-blue-100`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };



  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const res = await fetch('/api/users/users'); // Adjust path if needed
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to fetch');

        setCount(data.count);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCount();
  }, []);

  return (
    <div className={`${getToastStyles()} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">{getIcon()}</span>
        </div>
        <div className="flex-1">
          <p className="font-medium text-base leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-4 text-gray-300 hover:text-white transition-colors"
        >
          <span className="text-xl">×</span>
        </button>
      </div>
    </div>
  );
};

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: 'Register Doctor', href: '/' },
    { name: 'Search Doctor', href: '/doctor/search' },
    { name: 'Search Clinic', href: '/' },
  ];

  const treatments = [
    { name: 'Ayurvedic Hairfall Treatment' },
    { name: 'Panchakarma Treatment' },
    { name: 'Gastric Disorders Treatment' },
    { name: 'PCOS Treatment' },
    { name: 'Ayurvedic Diet Plan' },
    { name: 'Skin Diseases Treatment' },
  ];

  const companyLinks = [
    { name: 'About Us', href: '/aboutus' },
    // { name: 'Careers', href: '#' },
    // { name: 'Press Kit', href: '#' },
    // { name: 'Blog', href: '#' },
    // { name: 'Help Center', href: '#' },
    // { name: 'Contact Support', href: '#' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'Cookie Policy', href: '#' },
    { name: 'GDPR Compliance', href: '#' },
    { name: 'Security', href: '#' },
    { name: 'Accessibility', href: '#' },
  ];

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    query: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Toast state
  const [toast, setToast] = useState({
    message: '',
    type: 'success',
    isVisible: false
  });

  // Enhanced validation function
  const validateForm = () => {
    const errors = [];

    // Name validation
    if (!formData.name || formData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    // Phone validation - handle both local and international formats
    const phoneRegex = /^\d{10}$/;

    if (!formData.phone) {
      errors.push('Phone number is required');
    } else {
      // Clean the phone number - remove spaces and keep only digits and +
      const cleanedPhone = formData.phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

      // Debug logging
      console.log('Phone validation:', {
        original: formData.phone,
        cleaned: cleanedPhone,
        startsWith971: cleanedPhone.startsWith('971'),
        startsWithPlus971: cleanedPhone.startsWith('+971')
      });

      // Check if it's a UAE number (starts with +971 or 971)
      if (cleanedPhone.startsWith('+971') || cleanedPhone.startsWith('971')) {
        // Remove country code and check if remaining digits are 9
        const localNumber = cleanedPhone.replace(/^(\+971|971)/, '');
        console.log('UAE number check:', { localNumber, length: localNumber.length });

        if (localNumber.length !== 9) {
          errors.push('UAE phone number must be 9 digits after country code (e.g., +971501234567)');
        }
      } else {
        // Check for local 10-digit format
        console.log('Local number check:', { cleanedPhone, isValid: phoneRegex.test(cleanedPhone) });
        if (!phoneRegex.test(cleanedPhone)) {
          errors.push('Phone number must be exactly 10 digits (e.g., 0501234567) or valid UAE format (+971501234567)');
        }
      }
    }

    // Location validation
    if (!formData.location || formData.location.trim().length < 2) {
      errors.push('Location must be at least 2 characters long');
    }

    // Query validation
    if (!formData.query || formData.query.trim().length < 10) {
      errors.push('Query must be at least 10 characters long');
    }

    return errors;
  };

  // Toast functions
  const showToast = (message, type = 'success') => {
    setToast({
      message,
      type,
      isVisible: true
    });

    // Auto hide after 6 seconds for error messages, 4 seconds for success
    const timeout = type === 'error' ? 6000 : 4000;
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, timeout);
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getDetailedErrorMessage = (error, response) => {
    // Check for specific HTTP status codes
    if (response) {
      switch (response.status) {
        case 400:
          return 'Invalid form data submitted. Please check all fields and try again.';
        case 401:
          return 'Authentication failed. Please refresh the page and try again.';
        case 403:
          return 'Access denied. You may not have permission to submit this form.';
        case 404:
          return 'Service not found. Please contact support if this issue persists.';
        case 408:
          return 'Request timeout. The server took too long to respond. Please try again.';
        case 409:
          return 'Duplicate submission detected. Please wait before submitting again.';
        case 422:
          return 'Please check your input and try again.';
        case 429:
          return 'Too many requests. Please wait a few minutes before trying again.';
        case 500:
          return 'Internal server error. Our team has been notified. Please try again later.';
        case 502:
          return 'Bad gateway. The server is temporarily unavailable. Please try again.';
        case 503:
          return 'Service temporarily unavailable. Please try again in a few minutes.';
        case 504:
          return 'Gateway timeout. The request took too long to process. Please try again.';
        default:
          return `Server error (${response.status}). Please try again or contact support.`;
      }
    }

    // Check for network-related errors
    if (error?.name === 'TypeError' && error.message.includes('fetch')) {
      return 'Network connection failed. Please check your internet connection and try again.';
    }

    if (error?.name === 'AbortError') {
      return 'Request was cancelled. Please try submitting the form again.';
    }

    if (error?.message.includes('NetworkError')) {
      return 'Network error occurred. Please check your connection and try again.';
    }

    if (error?.message.includes('CORS')) {
      return 'Cross-origin request blocked. Please contact support for assistance.';
    }

    // Generic fallback
    return `Submission failed: ${error?.message || 'Unknown error occurred'}. Please try again.`;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      // Show specific error messages for each validation failure
      const errorMessage = validationErrors.length === 1
        ? validationErrors[0]
        : `Please fix the following issues: ${validationErrors.join(', ')}`;

      showToast(` ${errorMessage}`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/users/get-in-touch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log('Success:', result.message);
        setFormData({
          name: '',
          phone: '',
          location: '',
          query: '',
        });
        showToast('🎉 Query submitted successfully! We\'ll get back to you soon.', 'success');
      } else {
        // Try to parse error response
        let errorMessage = 'Unknown server error occurred';
        let errorDetails = '';

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || getDetailedErrorMessage(null, response);
          errorDetails = errorData.details || errorData.errors?.join(', ') || '';
        } catch {
          errorMessage = getDetailedErrorMessage(null, response);
        }

        console.error('Server Error:', errorMessage);

        // Show detailed error message if available
        const finalErrorMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
        showToast(`❌ ${finalErrorMessage}`, 'error');
      }
    } catch (error) {
      console.error('Network/Client Error:', error);
      const detailedError = getDetailedErrorMessage(error, null);
      showToast(`🔄 ${detailedError}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const res = await fetch('/api/users/users'); // Adjust path if needed
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to fetch');

        setCount(data.count);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCount();
  }, []);

  return (
    <>
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      <footer className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 text-white relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`
          }}></div>
        </div>

        <div className="relative z-10">
          {/* Main Footer Content */}
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

              {/* Left Side - Footer Links (8 columns on large screens) */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                  {/* Brand Section */}
                  <div className="md:col-span-2 lg:col-span-1 space-y-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xl">Z</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Zeva</h3>
                        {/* <p className="text-sm text-slate-400">Your Digital OS</p> */}
                      </div>
                    </div>

                    <p className="text-slate-300 text-sm leading-relaxed">
                      Empowering individuals and businesses with an integrated digital ecosystem for health, career, and lifestyle management.
                    </p>
                  </div>

                  {/* All Modules */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-white flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                      All Modules
                    </h4>
                    <ul className="space-y-3">
                      {[
                        { name: '🎮 Games', href: 'games/allgames' },
                        { name: '🧮 Calculators', href: 'calculator/allcacl' },
                        { name: '💼 Jobs', href: 'job-listings' },
                        // { name: '📅 Book Appointment', href: '#' },
                        { name: '🩺 Doctor Login', href: 'doctor/login' },
                        { name: '🏥 Health Center Login', href: 'clinic/login-clinic' },
                        { name: '📝 Blogs', href: 'blogs/viewBlogs' }
                      ].map((item, index) => (
                        <li key={index}>
                          <a href={item.href} className="text-slate-300 hover:text-white transition-colors text-sm flex items-center group">
                            <span className="mr-2">{item.name.split(' ')[0]}</span>
                            <span className="group-hover:translate-x-1 transition-transform">{item.name.substring(2)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Company */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-white flex items-center">
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                      Company
                    </h4>
                    <ul className="space-y-3">
                      {companyLinks.map((link, index) => (
                        <li key={index}>
                          <Link href={link.href}>
                            <span className="text-slate-300 hover:text-white transition-colors text-sm hover:translate-x-1 inline-block transition-transform cursor-pointer">
                              {link.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* Contact Info */}
                    <div className="space-y-3 pt-4">
                      <h5 className="text-sm font-semibold text-slate-200">Contact Us</h5>
                      <div className="space-y-2">
                        <p className="text-slate-300 text-xs flex items-center">
                          <span className="mr-2">📧</span> support@zeva.com
                        </p>
                        <p className="text-slate-300 text-xs flex items-center">
                          <span className="mr-2">📞</span> +1 (555) 123-ZEVA
                        </p>
                        <p className="text-slate-300 text-xs flex items-center">
                          <span className="mr-2">📍</span> Abu Dhabi, UAE
                        </p>
                        <p className="text-slate-300 text-xs flex items-center">
                          <span className="mr-2">🌍</span> Available Worldwide
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Legal & Security */}
                  <div className="space-y-6">
                    {/* <h4 className="text-lg font-semibold text-white flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Legal & Security
                    </h4> */}
                    {/* <ul className="space-y-3">
                      {legalLinks.map((link, index) => (
                        <li key={index}>
                          <Link href={link.href}>
                            <span className="text-slate-300 hover:text-white transition-colors text-sm hover:translate-x-1 inline-block transition-transform cursor-pointer">
                              {link.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul> */}

                    {/* Certifications */}
                    <div className="space-y-4 pt-4">
                      <h5 className="text-sm font-semibold text-slate-200">Certifications</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                          <div className="text-2xl mb-1">🛡️</div>
                          <p className="text-xs font-medium text-slate-300">SOC 2 Certified</p>
                        </div>
                        <div className="text-center p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                          <div className="text-2xl mb-1">🏆</div>
                          <p className="text-xs font-medium text-slate-300">Industry Leader</p>
                        </div>
                        <div className="text-center p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                          <div className="text-2xl mb-1">⚡</div>
                          <p className="text-xs font-medium text-slate-300">99.9% Uptime</p>
                        </div>
                        <div className="text-center p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                          <div className="text-2xl mb-1">❤️</div>
                          <p className="text-xs font-medium text-slate-300">Trusted by 50K+</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Contact Form (4 columns on large screens) */}
              <div className="lg:col-span-4">
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl mb-3">
                      <span className="text-xl">📞</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Get In Touch</h3>
                    <p className="text-sm text-slate-400">We'd love to hear from you</p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-xs font-medium text-slate-300 mb-2">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={handleFormChange}
                        required
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-xs font-medium text-slate-300 mb-2">
                        Phone Number
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="\d*"
                        placeholder="Enter phone (e.g. 0501234567 or +971501234567)"
                        value={formData.phone}
                        onChange={(e) => {
                          const numericValue = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({ ...prev, phone: numericValue }));
                        }}
                        required
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="location" className="block text-xs font-medium text-slate-300 mb-2">
                        Location
                      </label>
                      <input
                        id="location"
                        name="location"
                        type="text"
                        placeholder="Enter your location"
                        value={formData.location}
                        onChange={handleFormChange}
                        required
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="query" className="block text-xs font-medium text-slate-300 mb-2">
                        Your Message
                      </label>
                      <textarea
                        id="query"
                        name="query"
                        placeholder="Tell us about your question (minimum 10 characters)..."
                        value={formData.query}
                        onChange={handleFormChange}
                        required
                        rows={4}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm disabled:opacity-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Message</span>
                            <span>📤</span>
                          </>
                        )}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="border-t border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="text-center text-black">
                  {count !== null && (
                    <div className="text-xl lg:text-2xl font-bold text-white">{formatCount(count)}</div>
                  )}
                  <div className="text-slate-400 text-sm">Active Users</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">6</div>
                  <div className="text-sm text-slate-400">Integrated Modules</div>
                </div>
                {/* <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">99.9%</div>
                  <div className="text-sm text-slate-400">Uptime SLA</div>
                </div> */}
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div className="text-sm text-slate-400">Support</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-700/50 bg-slate-900/70 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <div className="text-slate-400 text-sm">
                  © {currentYear} Zeva Digital Platform. All rights reserved.
                </div>

                {/* <div className="flex items-center space-x-6 text-sm">
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Sitemap
                  </Link>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    System Status
                  </Link>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    API Docs
                  </Link>
                </div> */}

                <div className="flex items-center text-slate-400 text-sm">
                  <span>Made with</span>
                  <span className="text-red-400 mx-1 animate-pulse">❤️</span>
                  <span>for your health</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;