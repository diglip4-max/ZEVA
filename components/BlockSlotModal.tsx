"use client";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  X,
  Loader2,
  Ban,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Building2,
} from "lucide-react";
import { ModalPortal } from "../lib/modalPortal";

interface DoctorStaffOption {
  _id: string;
  name: string;
  email?: string;
}

interface RoomOption {
  _id: string;
  name: string;
}

interface BlockSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate: string; // YYYY-MM-DD
  defaultFromTime?: string; // HH:MM
  defaultToTime?: string; // HH:MM
  defaultDoctorId?: string;
  defaultRoomId?: string;
  doctorStaff: DoctorStaffOption[];
  rooms: RoomOption[];
  getAuthHeaders: () => Record<string, string>;
}

const format12Hour = (t: string): string => {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const BlockSlotModal: React.FC<BlockSlotModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  defaultFromTime,
  defaultToTime,
  defaultDoctorId,
  defaultRoomId,
  doctorStaff,
  rooms,
  getAuthHeaders,
}) => {
  const [startDate, setStartDate] = useState<string>(defaultDate || "");
  const [fromTime, setFromTime] = useState<string>(defaultFromTime || "");
  const [toTime, setToTime] = useState<string>(defaultToTime || "");
  const [doctorId, setDoctorId] = useState<string>(defaultDoctorId || "");
  const [roomId, setRoomId] = useState<string>(defaultRoomId || "");
  const [reason, setReason] = useState<string>("");
  const [scope, setScope] = useState<"doctor" | "room" | "both">("doctor");
  const [saving, setSaving] = useState(false);

  // Re-initialize when modal opens with new defaults
  useEffect(() => {
    if (isOpen) {
      setStartDate(defaultDate || "");
      setFromTime(defaultFromTime || "");
      setToTime(defaultToTime || "");
      setReason("");

      // Determine scope based on incoming defaults
      const hasDoctor = !!defaultDoctorId;
      const hasRoom = !!defaultRoomId;
      if (hasDoctor && hasRoom) setScope("both");
      else if (hasDoctor) setScope("doctor");
      else if (hasRoom) setScope("room");
      else setScope("doctor");

      setDoctorId(defaultDoctorId || "");
      setRoomId(defaultRoomId || "");
    }
  }, [
    isOpen,
    defaultDate,
    defaultFromTime,
    defaultToTime,
    defaultDoctorId,
    defaultRoomId,
  ]);

  // Enforce scope-based clearing
  useEffect(() => {
    if (scope === "doctor") setRoomId("");
    if (scope === "room") setDoctorId("");
  }, [scope]);

  const doctorLabel = useMemo(() => {
    if (!doctorId) return "—";
    const d = doctorStaff.find((doc) => doc._id === doctorId);
    return d?.name || "Selected doctor";
  }, [doctorId, doctorStaff]);

  const roomLabel = useMemo(() => {
    if (!roomId) return "—";
    const r = rooms.find((room) => room._id === roomId);
    return r?.name || "Selected room";
  }, [roomId, rooms]);

  const validate = (): string | null => {
    if (!startDate) return "Please select a date";
    if (!fromTime || !toTime)
      return "Please select both start and end times";
    if (fromTime >= toTime) return "End time must be after start time";

    if (scope === "doctor" && !doctorId) return "Please select a doctor";
    if (scope === "both" && !doctorId && !roomId)
      return "Please select at least a doctor or a room";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        startDate,
        fromTime,
        toTime,
        reason: reason.trim(),
      };
      if (scope === "doctor" || scope === "both") {
        if (doctorId) payload.doctorId = doctorId;
      }
      if (scope === "room" || scope === "both") {
        if (roomId) payload.roomId = roomId;
      }
      // Safety: ensure at least one of doctorId/roomId is present
      if (!payload.doctorId && !payload.roomId) {
        toast.error("Please select at least a doctor or a room");
        setSaving(false);
        return;
      }

      const res = await axios.post("/api/clinic/blocked-slots", payload, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        toast.success("Time slot blocked successfully", { duration: 2500 });
        onSuccess();
        onClose();
      } else {
        toast.error(res.data.message || "Failed to block time slot");
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to block time slot"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-4 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Block Time Slot
                </h2>
                <p className="text-[11px] text-gray-500">
                  Prevent new bookings within the selected time range
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              type="button"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Warning */}
          <div className="mb-4 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-800 leading-snug">
              Existing appointments in the blocked range are not affected. Only
              new bookings are prevented until the slot is unblocked.
            </p>
          </div>

          <div className="space-y-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  From
                </label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {fromTime && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    {format12Hour(fromTime)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  To
                </label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {toTime && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    {format12Hour(toTime)}
                  </p>
                )}
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Block Scope
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setScope("doctor")}
                  className={`text-xs py-1.5 rounded-lg border transition-colors ${
                    scope === "doctor"
                      ? "bg-red-50 border-red-300 text-red-700 font-semibold"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setScope("room")}
                  className={`text-xs py-1.5 rounded-lg border transition-colors ${
                    scope === "room"
                      ? "bg-red-50 border-red-300 text-red-700 font-semibold"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Room
                </button>
                <button
                  type="button"
                  onClick={() => setScope("both")}
                  className={`text-xs py-1.5 rounded-lg border transition-colors ${
                    scope === "both"
                      ? "bg-red-50 border-red-300 text-red-700 font-semibold"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Doctor + Room
                </button>
              </div>
            </div>

            {/* Doctor / Room fields (reused from existing data) */}
            {(scope === "doctor" || scope === "both") && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <User className="w-3 h-3 inline mr-1" />
                  Doctor
                  {scope === "both" && (
                    <span className="text-[10px] text-gray-500 ml-1">
                      (optional)
                    </span>
                  )}
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select doctor</option>
                  {doctorStaff.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(scope === "room" || scope === "both") && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Building2 className="w-3 h-3 inline mr-1" />
                  Room
                  {scope === "both" && (
                    <span className="text-[10px] text-gray-500 ml-1">
                      (optional)
                    </span>
                  )}
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select room</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Doctor off, Maintenance"
                maxLength={200}
                className="w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-[11px] text-gray-700 leading-relaxed">
              <p>
                <span className="font-semibold">Block:</span> {startDate || "—"} ·{" "}
                {fromTime ? format12Hour(fromTime) : "—"} -{" "}
                {toTime ? format12Hour(toTime) : "—"}
              </p>
              <p>
                <span className="font-semibold">Doctor:</span> {doctorLabel}
              </p>
              <p>
                <span className="font-semibold">Room:</span> {roomLabel}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  Block Slot
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-60 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BlockSlotModal;
