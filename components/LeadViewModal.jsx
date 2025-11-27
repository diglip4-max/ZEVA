import React from "react";

export default function LeadViewModal({ lead, onClose }) {
  if (!lead) return null;

  const treatmentsText = lead.treatments
    ?.map((t) => (t.subTreatment ? `${t.subTreatment} (${t.treatment?.name || "Unknown"})` : t.treatment?.name))
    .join(", ") || "—";

  const notesText = lead.notes?.map((n) => n.text).join(", ") || "—";
  const assignedText = lead.assignedTo?.map((a) => a.user?.name).join(", ") || "—";
  const followUpsText = lead.followUps?.map((f) => new Date(f.date).toLocaleString()).join(", ") || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-[90vh]">
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
              {String(lead.name || "L").trim().slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Lead Details</h3>
              <p className="text-[10px] sm:text-xs text-gray-500">Complete information for the selected lead</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors">Close</button>
        </div>

        {/* Compact Body (scrolls independently) */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[65vh]">
          {/* Primary facts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Name</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{lead.name || "—"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Phone</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{lead.phone || "—"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Status</p>
              <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${lead.status === 'Booked' || lead.status === 'Visited' ? 'bg-green-100 text-green-700' : lead.status === 'Not Interested' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{lead.status || '—'}</span>
            </div>
          </div>

          {/* Secondary facts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Gender</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{lead.gender || "—"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Age</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{lead.age || "—"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Source</p>
              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[10px] font-medium">{lead.source || '—'}</span>
            </div>
          </div>

          {/* Treatments */}
          <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Treatments</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed text-xs sm:text-sm">{treatmentsText}</p>
          </div>

          {/* Offer and Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Offer Tag</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{lead.offerTag || "—"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Assigned To</p>
              <p className="mt-1 font-medium text-gray-900 text-xs sm:text-sm">{assignedText}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Notes</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed text-xs sm:text-sm">{notesText}</p>
          </div>

          {/* Follow ups */}
          <div className="rounded-lg border border-gray-200 p-2.5 sm:p-3 bg-white">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Follow-ups</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed text-xs sm:text-sm">{followUpsText}</p>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex justify-end">
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}


