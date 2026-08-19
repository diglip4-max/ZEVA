import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Open Slots card.
 *
 * Data shape (from /api/agent/open-slots):
 *   {
 *     doctors: [
 *       {
 *         doctorId: "...",
 *         name: "Dr. Mehta",
 *         department: "Dermatology",
 *         initials: "MH",
 *         initialsBg: "bg-purple-500",
 *         slots: [
 *           { time: "2:30 PM", fromTime: "14:30" },
 *           { time: "4:30 PM", fromTime: "16:30" },
 *         ],
 *       },
 *       ...
 *     ],
 *     totalSlots: 15,
 *   }
 *
 * Doctor login  → only that doctor's open slots.
 * Agent login   → all doctors' open slots across the clinic.
 *
 * Initially shows first 3 slots; "View All" opens a modal with all slots.
 * "Fill Slot" navigates to /clinic/appointment with doctor & time.
 */

const INITIAL_VISIBLE_SLOTS = 3;

export default function OpenSlots({ openSlotsData, modulePermissions }) {
  const router = useRouter();
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [showModal, setShowModal] = useState(false);
  const { doctors = [], totalSlots = 0 } = openSlotsData || {};

  const perms = modulePermissions || {};
  const appointmentActions = perms["clinic_Appointment"] || perms["Appointment"] || {};
  const canCreateAppointment = appointmentActions.create !== false;

  // Flatten all slots across doctors for initial preview
  const allSlotsFlat = doctors.flatMap((doc) =>
    doc.slots.map((slot) => ({ ...slot, doctor: doc }))
  );
  const visibleSlots = allSlotsFlat.slice(0, INITIAL_VISIBLE_SLOTS);
  const hasMore = allSlotsFlat.length > INITIAL_VISIBLE_SLOTS;

  const handleFillSlot = (doctor, slot) => {
    router.push({
      pathname: "/staff/clinic-appointment",
      query: {
        doctorId: doctor.doctorId,
        fromTime: slot.fromTime,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          OPEN SLOTS
        </p>
        {totalSlots > 0 && (
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {totalSlots} slot{totalSlots === 1 ? "" : "s"} open
          </span>
        )}
      </div>

      {allSlotsFlat.length > 0 ? (
        <>
          <div className="space-y-3">
            {visibleSlots.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 border border-gray-100 dark:border-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full ${item.doctor.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-white font-bold text-xs">{item.doctor.initials}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {item.time}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        · {item.doctor.name}
                      </span>
                    </div>
                  </div>
                </div>
                {canCreateAppointment && (
                  <button
                    onClick={() => handleFillSlot(item.doctor, item)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0"
                  >
                    Fill Slot
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* View All button to open modal */}
          {hasMore && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/15 shadow-sm transition-all duration-200 text-base"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              View All ({totalSlots} slots)
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            No open slots available.
          </p>
        </div>
      )}

      {/* Modal showing all slots */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">All Open Slots</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {totalSlots} slot{totalSlots === 1 ? "" : "s"} available across {doctors.length} doctor{doctors.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="space-y-6">
                {doctors.map((doctor) => (
                  <div key={doctor.doctorId}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-9 h-9 rounded-full ${doctor.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-white font-bold text-xs">{doctor.initials}</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                          {doctor.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                          {doctor.department} · {doctor.slots.length} slot{doctor.slots.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 ml-12">
                      {doctor.slots.map((slot, slotIdx) => (
                        <div
                          key={slotIdx}
                          className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 border border-gray-100 dark:border-white/5"
                        >
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                              {slot.time}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                              Open
                            </span>
                          </div>
                          {canCreateAppointment && (
                            <button
                              onClick={() => handleFillSlot(doctor, slot)}
                              className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0"
                            >
                              Fill Slot
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
