"use client";

import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";

const SLIDES = ["/image1.png", "/image2.png"] as const;

export default function AppointmentLandingPage(): React.ReactElement {
  const [imgOk, setImgOk] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);

  const title = useMemo(() => "ZEVA | Appointment Schedule", []);
  const currentSlideSrc = SLIDES[slideIndex] || SLIDES[0];
  const isMobileSlide = currentSlideSrc === "/image2.png";

  useEffect(() => {
    // Reset error state when slide changes
    setImgOk(true);
  }, [slideIndex]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % SLIDES.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="A modern appointment scheduling experience for clinics — fast, flexible, and easy to use."
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-white via-white to-gray-50">
        {/* Top bar */}
      

        {/* Hero */}
        <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="flex flex-col items-center">
            {/* Title + CTA */}
            <div className="w-full max-w-3xl text-center">
           
              <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
                The #1 software for doctors and clinics
              </h1>
              <p className="mt-4 text-base text-gray-600 sm:text-lg">
                Doctors, rooms, and time-slots in one place — designed for daily clinic workflows.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/clinic/appointment"
                  className="rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-black transition"
                >
                  View schedule
                </Link>
                <Link
                  href="/clinic/all-appointment"
                  className="rounded-full border border-gray-300 px-6 py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
                >
                  All appointments
                </Link>
              </div>

          
            </div>

            {/* Screenshot section with colored background + stats (like reference) */}
            <div className="relative mt-10 w-full max-w-6xl">
              <div className="relative overflow-hidden rounded-3xl bg-white p-5 sm:p-7">
                {/* soft blobs */}
                <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
                <div className="pointer-events-none absolute left-1/3 -bottom-24 h-80 w-80 rounded-full bg-pink-300/20 blur-3xl" />

                {/* Slideshow card */}
                <div className="relative overflow-hidden rounded-3xl border border-white/25 bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                    {/* Slideshow controls */}
                    <div className="ml-auto flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {SLIDES.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSlideIndex(i)}
                            className={`h-2 w-2 rounded-full transition ${
                              i === slideIndex ? "bg-emerald-500" : "bg-orange-300 hover:bg-orange-400"
                            }`}
                            aria-label={`Go to screenshot ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fixed size container for BOTH slides */}
                  <div className="relative h-[420px] sm:h-[520px] bg-white">
                    {imgOk ? (
                      <Image
                        key={currentSlideSrc}
                        src={currentSlideSrc}
                        alt="Clinic appointment preview"
                        fill
                        className={`transition-opacity duration-300 object-contain bg-white ${
                          isMobileSlide ? "p-2 sm:p-4" : ""
                        }`}
                        sizes="(max-width: 1024px) 100vw, 1100px"
                        onError={() => setImgOk(false)}
                        priority
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white p-6 text-center">
                        <div className="h-12 w-12 rounded-2xl bg-gray-900 text-black flex items-center justify-center font-black">
                          Z
                        </div>
                        <p className="text-sm font-bold text-gray-900">Screenshot not found</p>
                        <p className="text-sm text-gray-600">
                          Add the image at{" "}
                          <span className="font-mono text-[13px] text-gray-800">public{currentSlideSrc}</span>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom stats strip */}
                <div className="mt-6 grid grid-cols-2 gap-5 text-center text-black sm:grid-cols-4">
                  <div>
                    <p className="text-xl sm:text-4xl font-black tracking-tight">130,000+</p>
                    <p className="mt-1 text-sm sm:text-base text-black">Partner businesses</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-4xl font-black tracking-tight">450,000+</p>
                    <p className="mt-1 text-sm sm:text-base text-black">Professionals</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-4xl font-black tracking-tight">1 Billion+</p>
                    <p className="mt-1 text-sm sm:text-base text-black">Appointments booked</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-4xl font-black tracking-tight">120+</p>
                    <p className="mt-1 text-sm sm:text-base text-black">Countries</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

     
      </div>
    </>
  );
}


