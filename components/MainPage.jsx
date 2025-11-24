import React, { useState, useEffect } from 'react';
import { Heart, Users, Sparkles, Play, Calendar } from 'lucide-react';

const ZevaHealthPlatform = () => {
    const [showComingSoon, setShowComingSoon] = useState(false);

    const handleBookAppointment = () => {
        setShowComingSoon(true);
        setTimeout(() => setShowComingSoon(false), 3000);
    };
    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12">
                <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                    {/* Left Section */}
                    <div className="space-y-4 lg:space-y-6">
                        {/* Badge */}
                        {/* <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-full text-sm font-semibold shadow-lg hover:scale-105 transition-all duration-300">
                            <Play className="w-4 h-4 animate-pulse" />
                            The Future of Connected Living
                        </div> */}


                        {/* Main Heading */}
                        <div className="space-y-3">
                            <h1 className="text-1xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">
                                The <span className="text-purple-600">Nexus</span> for<br />
                                <span className="text-purple-600">Health, Career</span> &<br />
                                <span className="text-purple-600">Lifestyle Mastery</span>
                            </h1>

                            <div className="space-y-2 text-gray-600 max-w-lg">
                                <p className="text-base">
                                    Simplify and supercharge your digital world with <span className="font-semibold text-gray-900">Zeva’s all-in-one ecosystem</span>.
                                </p>
                                <p className="text-base">
                                    Seamlessly connect your <span className="text-purple-600 font-medium">healthcare, career, gaming,</span> and <span className="text-purple-600 font-medium">marketplace</span> experiences.
                                </p>
                                <p className="text-base">
                                    Everything you need — <span className="font-semibold text-gray-900">integrated, intelligent, and beautifully designed</span>.
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">

                            <button
                                onClick={handleBookAppointment}
                                className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center relative overflow-hidden ${showComingSoon
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                <div className={`flex items-center transition-all duration-300 ${showComingSoon ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}>
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Book Appointment
                                </div>
                                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${showComingSoon ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Coming Soon!
                                </div>
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 pt-6">
                            <div className="text-center text-black">
                                {count !== null && (
                                    <div className="text-xl lg:text-2xl font-bold text-gray-900">{formatCount(count)}</div>
                                )}
                                <div className="text-gray-600 text-sm">Active Users</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl lg:text-2xl font-bold text-gray-900">8</div>
                                <div className="text-gray-600 text-sm">Integrated Modules</div>
                            </div>
                            {/* <div className="text-center">
                                <div className="text-xl lg:text-2xl font-bold text-gray-900">99.9%</div>
                                <div className="text-gray-600 text-sm">Uptime</div>
                            </div> */}
                        </div>
                    </div>

                    {/* Right Section - Feature Cards Grid */}
                    <div className="grid grid-cols-2 gap-3 lg:gap-4">
                        {/* Dr. Healthcare */}
                        <a
                            href="/clinic/findclinic"
                            className="block relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group transform hover:scale-[1.02]"
                        >
                            {/* Background Image */}
                            <div className="relative h-48 lg:h-56">
                                <img
                                    src="https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=80"
                                    alt="Healthcare Clinic"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20 transition-colors duration-300"></div>

                                {/* Icon Badge */}
                                <div className="absolute top-4 left-4 w-12 h-12 bg-teal-400 rounded-xl flex items-center justify-center shadow-lg">
                                    <Heart className="w-6 h-6 text-white" />
                                </div>

                                {/* Click indicator - Arrow or Text */}
                                <div className="text-black absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg transition-all duration-300">
                                    <span className="text-sm font-semibold">Find Clinic →</span>
                                </div>
                            </div>
                        </a>


                        {/* Healthcare */}
                        <a
                            href="/doctor/search"
                            className="block relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group transform hover:scale-[1.02]"
                            aria-label="Find a doctor near you"
                        >
                            {/* Background Image */}
                            <div className="relative h-48 lg:h-56">
                                <img
                                    src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&q=80"
                                    alt="Doctor Image"
                                    className="w-full h-full object-cover"
                                />
                                {/* Overlay that lightens on hover */}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>

                                {/* Icon Badge with hover animation */}
                                <div className="absolute top-4 left-4 w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Users className="w-6 h-6 text-white" />
                                </div>

                                {/* CTA Button with animated arrow */}
                                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg group-hover:bg-white transition-all duration-300">
                                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                        Find Doctor
                                        <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">→</span>
                                    </span>
                                </div>
                            </div>
                        </a>

                        {/* Lead Management */}
                        {/* <div className="bg-white border border-gray-200 rounded-xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mb-3">
                                <Users className="w-4 h-4 text-white" />
                            </div>
                            <div className="h-16 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg mb-3 flex items-center justify-center">
                                <Users className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="text-sm lg:text-base font-semibold text-gray-900 mb-1">Lead Management</h3>
                            <p className="text-gray-600 text-xs">Business Growth</p>
                        </div> */}

                        {/* Health Calculators */}
                        {/* <div className="bg-white border border-gray-200 rounded-xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mb-3">
                                <Calculator className="w-4 h-4 text-white" />
                            </div>
                            <div className="h-16 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg mb-3 flex items-center justify-center">
                                <Calculator className="w-8 h-8 text-orange-600" />
                            </div>
                            <h3 className="text-sm lg:text-base font-semibold text-gray-900 mb-1">Health Calculators</h3>
                            <p className="text-gray-600 text-xs">Health Analytics</p>
                        </div> */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ZevaHealthPlatform;