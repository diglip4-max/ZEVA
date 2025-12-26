import React, { useState, useRef, useEffect } from 'react';
import {
  Droplet, Dumbbell, Scale, Activity, Wind, Apple, ArrowRight,
  ChevronLeft, ChevronRight, Gamepad2, Target, Brain, Heart, BookOpen
} from 'lucide-react';

const Link = ({ href, onClick, className, children }) => (
  <a href={href} onClick={onClick} className={className}>
    {children}
  </a>
);

export const calculators = [
  {
    id: 'pregnancy-and-ovulation/pregnancy&ovulation',
    title: 'Pregnancy & Periods Tracker',
    description: 'Free Pregnancy Calculator & Ovulation Calendar to track your cycle',
    icon: Droplet,
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
    category: 'Women Health',
    image: 'https://images.unsplash.com/photo-1493894473891-10fc1e5dbd22?w=400&h=200&fit=crop&auto=format'
  },
  {
    id: 'depression-test',
    title: 'Depression Test Calculator',
    description: 'Begin a gentle test to understand depression signs',
    icon: Brain,
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
    category: 'Mental Health',
    image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=200&fit=crop"
  },
  {
    id: 'bmi',
    title: 'BMI Calculator',
    description: 'Calculate your Body Mass Index and understand your weight category',
    icon: Scale,
    bgColor: 'bg-gradient-to-br from-teal-500 to-teal-600',
    category: 'Body Metrics',
    image: 'https://images.unsplash.com/photo-1434596922112-19c563067271?w=400&h=200&fit=crop'
  },
  {
    id: 'bmr-tdee',
    title: 'BMR-TDEE Calculator',
    description: 'Calculate Basal Metabolic Rate & Total Daily Energy Expenditure',
    icon: Activity,
    bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600',
    category: 'Nutrition',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=200&fit=crop'
  },
  {
    id: 'breathhold',
    title: 'Breath Hold Calculator',
    description: 'Track your breath holding capacity and improve lung health',
    icon: Wind,
    bgColor: 'bg-gradient-to-br from-pink-500 to-pink-600',
    category: 'Respiratory',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=200&fit=crop'
  },
  {
    id: 'calorie-counter',
    title: 'Calorie Count Calculator',
    description: 'Track your daily calorie intake and maintain a healthy diet',
    icon: Apple,
    bgColor: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    category: 'Nutrition',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=200&fit=crop'
  },
  {
    id: 'heartrate',
    title: 'Heart Rate Monitor',
    description: 'Monitor your heart rate and cardiovascular health',
    icon: Activity,
    bgColor: 'bg-gradient-to-br from-red-500 to-red-600',
    category: 'Cardio Health',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=200&fit=crop'
  },
  {
    id: 'water',
    title: 'Water Intake Tracker',
    description: 'Track your daily water consumption for optimal hydration',
    icon: Apple,
    bgColor: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
    category: 'Hydration',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&h=200&fit=crop'
  }
];

export const games = [
  {
    id: 'fitwithzeva',
    title: 'Be Fit with Zeva',
    description: 'Fun Exercises to Boost Immunity & Strength',
    icon: Heart,
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
    category: 'Fitness',
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=200&fit=crop'
  },
  {
    id: 'quiz',
    title: 'Health Quiz Challenge',
    description: 'Test Your Health Knowledge Online',
    icon: BookOpen,
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
    category: 'Puzzle',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=200&fit=crop'
  },
  {
    id: 'flipcards',
    title: 'FitFlip Cards',
    description: 'Fun Exercise Game to Burn Calories Fast',
    icon: Dumbbell,
    bgColor: 'bg-gradient-to-br from-teal-500 to-teal-600',
    category: 'Action',
    image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=400&h=200&fit=crop'
  },
  {
    id: 'HealthyFood',
    title: 'Healthy Food Picker Game',
    description: 'Smash junk, grab greens, beat the clock!',
    icon: Target,
    bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600',
    category: 'RPG',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=200&fit=crop'
  }
];

const HealthCalculatorApp = () => {
  const sliderRef = useRef(null);
  const gamesSliderRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    function scrollToSectionIfHash() {
      if (window.location.hash === '#games-section' && sectionRef.current) {
        sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    scrollToSectionIfHash();
    window.addEventListener('hashchange', scrollToSectionIfHash);
    setTimeout(scrollToSectionIfHash, 100);
    return () => window.removeEventListener('hashchange', scrollToSectionIfHash);
  }, []);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -(window.innerWidth < 768 ? 320 : 380), behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: window.innerWidth < 768 ? 320 : 380, behavior: 'smooth' });
    }
  };

  const scrollGamesLeft = () => {
    if (gamesSliderRef.current) {
      gamesSliderRef.current.scrollBy({ left: -(window.innerWidth < 768 ? 320 : 380), behavior: 'smooth' });
    }
  };

  const scrollGamesRight = () => {
    if (gamesSliderRef.current) {
      gamesSliderRef.current.scrollBy({ left: window.innerWidth < 768 ? 320 : 380, behavior: 'smooth' });
    }
  };

  const getBadgeStyles = (badge) => {
    switch (badge) {
      case 'Hot': return 'bg-red-500';
      case 'New': return 'bg-emerald-500';
      case 'Trending': return 'bg-blue-500';
      case 'Popular': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Calculators Section */}
        <section ref={sectionRef} id="games-section" className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-gray-800 rounded-xl p-2.5 shadow-sm">
                <Activity className="text-white" size={24} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Health Calculators</h2>
                <p className="text-gray-600 mt-0.5 text-xs sm:text-sm">Professional wellness tools</p>
              </div>
            </div>
            <Link 
              href="/calculator/allcalc#games-section" 
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors group"
            >
              View All 
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="relative">
            <button 
              onClick={scrollLeft} 
              className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md rounded-full p-2 text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all border border-gray-200"
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button 
              onClick={scrollRight} 
              className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md rounded-full p-2 text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all border border-gray-200"
              aria-label="Scroll right"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>

            <div 
              ref={sliderRef} 
              className="flex overflow-x-auto gap-4 pb-4 scroll-smooth snap-x snap-mandatory hide-scrollbar"
            >
              {calculators.map((calc) => {
                const IconComponent = calc.icon;
                return (
                  <div key={calc.id} className="flex-shrink-0 w-[280px] sm:w-[300px] snap-start">
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 p-5 h-full group hover:border-gray-300">
                      
                      {/* Icon and Category */}
                      <div className="flex items-start justify-between mb-4">
                        <div className={`${calc.bgColor} rounded-lg p-3 shadow-sm group-hover:scale-105 transition-transform`}>
                          <IconComponent className="text-white" size={24} strokeWidth={2} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{calc.category}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-gray-900 text-base mb-2 leading-tight line-clamp-2">{calc.title}</h3>

                      {/* Description */}
                      <p className="text-gray-600 text-xs leading-relaxed mb-5 line-clamp-2">{calc.description}</p>

                      {/* Button */}
                      <Link 
                        href={`/calculator/${calc.id}#games-section`} 
                        className="w-full inline-flex items-center justify-center bg-gray-900 text-white px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-gray-800 transition-all group/btn"
                      >
                        Calculate 
                        <ArrowRight size={14} className="ml-1.5 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-6 md:hidden">
            <Link 
              href="/calculator/allcalc#games-section" 
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              View All Calculators 
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Games Section */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-gray-800 rounded-xl p-2.5 shadow-sm">
                <Gamepad2 className="text-white" size={24} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Health Games</h2>
                <p className="text-gray-600 mt-0.5 text-xs sm:text-sm">Learn through interactive play</p>
              </div>
            </div>
            <Link 
              href="/games/allgames#games-section" 
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors group"
            >
              View All 
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="relative">
            <button 
              onClick={scrollGamesLeft} 
              className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md rounded-full p-2 text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all border border-gray-200"
              aria-label="Scroll games left"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button 
              onClick={scrollGamesRight} 
              className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 bg-white shadow-md rounded-full p-2 text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all border border-gray-200"
              aria-label="Scroll games right"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>

            <div 
              ref={gamesSliderRef} 
              className="flex overflow-x-auto gap-4 pb-4 scroll-smooth snap-x snap-mandatory hide-scrollbar"
            >
              {games.map((game) => {
                const IconComponent = game.icon;
                return (
                  <div key={game.id} className="flex-shrink-0 w-[280px] sm:w-[300px] snap-start">
                    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 p-5 h-full group hover:border-gray-300">
                      
                      {/* Icon and Category */}
                      <div className="flex items-start justify-between mb-4">
                        <div className={`${game.bgColor} rounded-lg p-3 shadow-sm group-hover:scale-105 transition-transform`}>
                          <IconComponent className="text-white" size={24} strokeWidth={2} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{game.category}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-gray-900 text-base mb-2 leading-tight line-clamp-2">{game.title}</h3>

                      {/* Description */}
                      <p className="text-gray-600 text-xs leading-relaxed mb-5 line-clamp-2">{game.description}</p>

                      {/* Button */}
                      <Link 
                        href={`/games/${game.id}#games-section`} 
                        className="w-full inline-flex items-center justify-center bg-gray-900 text-white px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-gray-800 transition-all group/btn"
                      >
                        <Gamepad2 size={14} className="mr-1.5" /> 
                        Play Now
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-6 md:hidden">
            <Link 
              href="/games/allgames#games-section" 
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              View All Games 
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

      </div>

      <style jsx>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default HealthCalculatorApp;
