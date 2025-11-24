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
    description: 'Fun exercises boost immunity & strength',
    icon: Heart,
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
    category: 'Fitness',
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=200&fit=crop'
  },
  {
    id: 'quiz',
    title: 'Health Quiz Challenge',
    description: 'Test your health knowledge with quizzes',
    icon: BookOpen,
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
    category: 'Puzzle',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=200&fit=crop'
  },
  {
    id: 'flipcards',
    title: 'FitFlip Cards',
    description: 'Match exercises, burn calories fast',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Calculators Section */}
        <section ref={sectionRef} id="games-section" className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-3.5 shadow-lg">
                <Activity className="text-white" size={32} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Health Calculators</h2>
                <p className="text-slate-600 mt-1.5 text-base">Professional tools to monitor your wellness journey</p>
              </div>
            </div>
            <Link 
              href="/calculator/allcalc#games-section" 
              className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors group"
            >
              View All Calculators 
              <ArrowRight size={18} className="text-gray-700 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="relative">
            <button 
              onClick={scrollLeft} 
              className="hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full p-3.5 text-slate-700 hover:bg-slate-50 hover:shadow-2xl transition-all border border-slate-200"
              aria-label="Scroll left"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button 
              onClick={scrollRight} 
              className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full p-3.5 text-slate-700 hover:bg-slate-50 hover:shadow-2xl transition-all border border-slate-200"
              aria-label="Scroll right"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>

            <div 
              ref={sliderRef} 
              className="flex overflow-x-auto gap-6 pb-6 scroll-smooth snap-x snap-mandatory hide-scrollbar"
            >
              {calculators.map((calc) => {
                const IconComponent = calc.icon;
                return (
                  <div key={calc.id} className="flex-shrink-0 w-[340px] snap-start">
                    <div className="bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 border border-slate-200/60 p-8 h-full group">
                      
                      {/* Icon and Category */}
                      <div className="flex items-start justify-between mb-6">
                        <div className={`${calc.bgColor} rounded-3xl p-5 shadow-lg group-hover:scale-105 transition-transform`}>
                          <IconComponent className="text-white" size={36} strokeWidth={2} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{calc.category}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-blue-600 text-xl mb-4 leading-tight">{calc.title}</h3>

                      {/* Description */}
                      <p className="text-slate-600 text-sm leading-relaxed mb-8">{calc.description}</p>

                      {/* Button */}
                      <Link 
                        href={`/calculator/${calc.id}#games-section`} 
                        className="w-full inline-flex items-center justify-center bg-blue-100 text-blue-600 px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-200 transition-all group/btn"
                      >
                        Calculate Now 
                        <ArrowRight size={18} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link 
              href="/calculator/allcalc#games-section" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              View All Calculators 
              <ArrowRight size={16} className="text-gray-700" />
            </Link>
          </div>
        </section>

        {/* Games Section */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-pink-600 to-rose-600 rounded-2xl p-3.5 shadow-lg">
                <Gamepad2 className="text-white" size={32} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Health & Wellness Games</h2>
                <p className="text-slate-600 mt-1.5 text-base">Play engaging games while learning about health and fitness</p>
              </div>
            </div>
            <Link 
              href="/games/allgames#games-section" 
              className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors group"
            >
              View All Games 
              <ArrowRight size={18} className="text-gray-700 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="relative">
            <button 
              onClick={scrollGamesLeft} 
              className="hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full p-3.5 text-slate-700 hover:bg-slate-50 hover:shadow-2xl transition-all border border-slate-200"
              aria-label="Scroll games left"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button 
              onClick={scrollGamesRight} 
              className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-white shadow-xl rounded-full p-3.5 text-slate-700 hover:bg-slate-50 hover:shadow-2xl transition-all border border-slate-200"
              aria-label="Scroll games right"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>

            <div 
              ref={gamesSliderRef} 
              className="flex overflow-x-auto gap-6 pb-6 scroll-smooth snap-x snap-mandatory hide-scrollbar"
            >
              {games.map((game) => {
                const IconComponent = game.icon;
                return (
                  <div key={game.id} className="flex-shrink-0 w-[340px] snap-start">
                    <div className="bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 border border-slate-200/60 p-8 h-full group">
                      
                      {/* Icon and Category */}
                      <div className="flex items-start justify-between mb-6">
                        <div className={`${game.bgColor} rounded-3xl p-5 shadow-lg group-hover:scale-105 transition-transform`}>
                          <IconComponent className="text-white" size={36} strokeWidth={2} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{game.category}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-blue-600 text-xl mb-4 leading-tight">{game.title}</h3>

                      {/* Description */}
                      <p className="text-slate-600 text-sm leading-relaxed mb-8">{game.description}</p>

                      {/* Button */}
                      <Link 
                        href={`/games/${game.id}#games-section`} 
                        className="w-full inline-flex items-center justify-center bg-blue-100 text-blue-600 px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-200 transition-all group/btn"
                      >
                        <Gamepad2 size={18} className="mr-2" /> 
                        Play Now
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link 
              href="/games/allgames#games-section" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              View All Games 
              <ArrowRight size={16} className="text-gray-700" />
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