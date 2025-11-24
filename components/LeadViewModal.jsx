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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white/95 border border-gray-200 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-semibold">
              {String(lead.name || "L").trim().slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">Lead Details</h3>
              <p className="text-xs text-gray-500">Complete information for the selected lead</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Close</button>
        </div>

        {/* Body (scrolls independently) */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Primary facts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Name</p>
              <p className="mt-1 font-medium text-gray-900">{lead.name || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Phone</p>
              <p className="mt-1 font-medium text-gray-900">{lead.phone || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Status</p>
              <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${lead.status === 'Booked' || lead.status === 'Visited' ? 'bg-green-100 text-green-700' : lead.status === 'Not Interested' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{lead.status || '—'}</span>
            </div>
          </div>

          {/* Secondary facts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Gender</p>
              <p className="mt-1 font-medium text-gray-900">{lead.gender || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Age</p>
              <p className="mt-1 font-medium text-gray-900">{lead.age || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Source</p>
              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium">{lead.source || '—'}</span>
            </div>
          </div>

          {/* Treatments */}
          <div className="rounded-xl border border-gray-200 p-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Treatments</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed">{treatmentsText}</p>
          </div>

          {/* Offer and Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Offer Tag</p>
              <p className="mt-1 font-medium text-gray-900">{lead.offerTag || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Assigned To</p>
              <p className="mt-1 font-medium text-gray-900">{assignedText}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-gray-200 p-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Notes</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed">{notesText}</p>
          </div>

          {/* Follow ups */}
          <div className="rounded-xl border border-gray-200 p-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Follow-ups</p>
            <p className="mt-1 font-medium text-gray-900 leading-relaxed">{followUpsText}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end">
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">Close</button>
        </div>
      </div>
    </div>
  );
}


