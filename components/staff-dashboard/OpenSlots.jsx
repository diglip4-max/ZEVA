import React from "react";

export default function OpenSlots({ openSlotsDoctors }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-5">
        OPEN SLOTS
      </p>

      <div className="space-y-5">
        {openSlotsDoctors.map((doctor) => (
          <div key={doctor.id}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-full ${doctor.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <span className="text-white font-bold text-xs">{doctor.initials}</span>
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {doctor.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {doctor.department}
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
                      {slot.patients}
                    </span>
                  </div>
                  <button className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0">
                    Fill Slot
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
