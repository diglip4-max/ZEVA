// pages/allcalc.tsx
"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { calculators } from '../../components/CalculatorGames';

function AllCalculators(){
  const router = useRouter();

  const handleCalculatorClick = (calculatorId: string) => {
    console.log(`Navigating to calculator: ${calculatorId}`);
    router.push(`/calculator/${calculatorId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header Section */}
      <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 py-8 px-4 sm:py-10 sm:px-6 md:py-12 md:px-8">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto">
          {/* Go to Home Button */}
          <div className="mb-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-white border-opacity-30 transition-all duration-200 hover:scale-105"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="font-medium text-gray-700"></span>
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left side - Title and description */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
                Health Calculators
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white text-opacity-90 leading-relaxed">
                Zeva — empowering you with intelligent tools for a healthier, stronger, and more fulfilling life
              </p>
              <div className="mt-6 flex justify-center lg:justify-start">
                <div className="w-20 h-1 bg-white bg-opacity-60 rounded-full"></div>
              </div>
            </div>

            {/* Right side - Stats */}
            <div className="lg:justify-self-end">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl border border-white border-opacity-20 p-6 sm:p-8">
                <div className="grid grid-cols-3 gap-4 sm:gap-6">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-700 mb-1">
                      {calculators.length}
                    </div>
                    <div className="text-gray-700 text-opacity-80 text-xs sm:text-sm">
                      Health Tools
                    </div>
                  </div>
                  <div className="text-center border-l border-r border-white border-opacity-20">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-700 mb-1">
                      100%
                    </div>
                    <div className="text-gray-700 text-opacity-80 text-xs sm:text-sm">
                      Free to Use
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-700 mb-1">
                      24/7
                    </div>
                    <div className="text-gray-700 text-opacity-80 text-xs sm:text-sm">
                      Available
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calculators Grid Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {calculators.map((calc) => {
            const Icon = calc.icon;
            return (
              <div
                key={calc.id}
                className="group relative bg-slate-800 rounded-2xl border border-slate-700 hover:border-orange-500 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl overflow-hidden cursor-pointer"
                onClick={() => handleCalculatorClick(calc.id)}
              >
                {/* Image Container */}
                <div className="relative overflow-hidden rounded-t-2xl">
                  <Image
                    src={calc.image}
                    alt={calc.title}
                    width={400}
                    height={176}
                    className="w-full h-36 sm:h-40 md:h-44 object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>

                  {/* Calculate button on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Icon Badge */}
                  <div className="absolute top-3 right-3 w-10 h-10 bg-slate-900 bg-opacity-80 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Icon className="text-orange-500" size={18} />
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-start mb-3">
                    <div className="w-8 h-8 bg-orange-500 bg-opacity-10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Icon className="text-orange-500" size={16} />
                    </div>
                    <h2 className="text-white text-base sm:text-lg font-bold leading-tight group-hover:text-orange-500 transition-colors duration-300">
                      {calc.title}
                    </h2>
                  </div>

                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 line-clamp-3">
                    {calc.description}
                  </p>

                  {/* Action Button */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleCalculatorClick(calc.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                      Calculate
                    </button>
                    <div className="flex items-center text-xs text-slate-500">
                      <svg className="w-4 h-4 mr-1 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                      Free
                    </div>
                  </div>
                </div>

                {/* Hover Border Effect */}
                <div className="absolute inset-0 rounded-2xl border-2 border-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

AllCalculators.getLayout = function PageLayout(page: React.ReactNode) {
  return page;
};

export default AllCalculators;