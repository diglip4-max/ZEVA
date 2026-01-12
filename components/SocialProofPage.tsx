"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

/* -------------------- COUNT HOOK -------------------- */
const useCountUp = (end: number, duration = 1500) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
};

/* -------------------- STATS SECTION -------------------- */
const StatsSection = () => {
  const clinics = useCountUp(5000);
  const appointments = useCountUp(200000);
  const cities = useCountUp(50);
  const professionals = useCountUp(15000);

  const stats = [
    { value: clinics.toLocaleString() + "+", label: "Clinics Listed" },
    { value: appointments.toLocaleString() + "+", label: "Appointments Booked" },
    { value: cities + "+", label: "Cities Covered" },
    { value: professionals.toLocaleString() + "+", label: "Healthcare Professionals" },
  ];

  return (
    <div className="mb-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative bg-white rounded-[32px] border border-gray-200 shadow-xl px-6 py-14">
          
          {/* Badge */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-50 text-amber-600 text-sm font-medium">
              📈 Growing Every Day
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 text-center mt-6">
            {stats.map((item, i) => (
              <div key={i} className="relative">
                <div className="text-4xl md:text-5xl font-bold text-amber-400 transition-all">
                  {item.value}
                </div>
                <div className="mt-2 text-gray-800 font-medium">
                  {item.label}
                </div>

                {i !== stats.length - 1 && (
                  <span className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-12 w-px bg-gray-200" />
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

/* -------------------- REVIEWS -------------------- */
const allReviews = [
  {
    text: "ZEVA made it so easy to find a specialist near me. Booked my appointment in under 2 minutes.",
    name: "Priya Sharma",
    role: "Patient · Mumbai",
    initials: "PS",
  },
  {
    text: "Managing appointments has never been easier. The platform is intuitive and my patients love it.",
    name: "Dr. Rajesh Kumar",
    role: "Cardiologist · Delhi",
    initials: "RK",
  },
  {
    text: "The telemedicine feature saved me so much time.",
    name: "Anita Desai",
    role: "Patient · Bangalore",
    initials: "AD",
  },
  {
    text: "Excellent platform for discovering verified clinics nearby.",
    name: "Rohit Mehta",
    role: "Patient · Pune",
    initials: "RM",
  },
  {
    text: "My clinic operations are smoother than ever thanks to ZEVA.",
    name: "Dr. Neha Verma",
    role: "Dermatologist · Jaipur",
    initials: "NV",
  },
  {
    text: "Simple UI and very fast booking experience.",
    name: "Sanjay Patel",
    role: "Patient · Ahmedabad",
    initials: "SP",
  },
];
// const partneredWith = [
//     { name: "Apollo Hospitals" },
//     { name: "Fortis Healthcare" },
//     { name: "Max Healthcare" },
//     { name: "Manipal Hospitals" },
//     { name: "AIIMS" },
//   ];
/* -------------------- MAIN PAGE -------------------- */
export default function SocialProofPage() {
  const [index, setIndex] = useState(0);

  const shuffledReviews = useMemo(
    () => [...allReviews].sort(() => Math.random() - 0.5),
    []
  );

  const visibleReviews = shuffledReviews.slice(index, index + 3);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) =>
        prev + 3 >= shuffledReviews.length ? 0 : prev + 3
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [shuffledReviews.length]);

  return (
    <section className="w-full bg-white py-8">
      <StatsSection />

      <div className="max-w-6xl mt-20 mx-auto px-4 text-center">
        {/* <span className="inline-block text-sm font-medium px-5 py-2 rounded-full bg-teal-50 text-teal-700">
          Social Proof
        </span> */}

        <h2 className="mt-2 text-xl md:text-3xl font-bold text-blue-700" style={{ fontFamily: "'Playfair Display', serif" }}>
          Trusted by Patients & Healthcare Providers
        </h2>

        <p className="mt-2 md:mt-3 text-base font-semibold text-gray-600" style={{ fontFamily: "'Playfair Display', serif" }}>
          Join thousands who trust ZEVA for their healthcare needs
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleReviews.map((review) => (
            <div
              key={review.name}
              className="border border-gray-200 rounded-2xl p-6 text-left bg-white shadow-sm animate-fade"
            >
              <div className="flex mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              <p className="text-sm text-gray-600">“{review.text}”</p>

              <div className="mt-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                  {review.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{review.name}</p>
                  <p className="text-xs text-gray-500">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      {/* Partners Section (BOTTOM) */}
      {/* <div className="mt-24 max-w-6xl mx-auto px-4 ">
      <div className="border border-gray-200 mt-2 rounded-2xl shadow-sm bg-white py-12 px-6 text-center">
      <h2 className="mt-2 text-lg font-semibold text-blue-700">
          Partnered with leading healthcare institutions
        </h2>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-8 items-center">
          {partneredWith.map(partner => (
            <div key={partner.name} className="flex justify-center">
             <span className="text-gray-600 hover:text-blue-700 cursor-pointer text-sm">{partner.name}</span>
            </div>
          ))}
        </div>
      </div>
      </div> */}
    </section>
  );
}
