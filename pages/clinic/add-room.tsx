"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import { Loader2, Trash2, AlertCircle, CheckCircle } from "lucide-react";

interface Room {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const MessageBanner = ({ type, text }: { type: "success" | "error" | "info"; text: string }) => {
  if (!text) return null;

  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };

  const Icon = type === "error" ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles[type]}`}>
      <Icon className="w-5 h-5" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
};

function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function AddRoomPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string }>({
    type: "info",
    text: "",
  });

  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/clinic/rooms", {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setRooms(res.data.rooms || []);
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to load rooms" });
      }
    } catch (error: any) {
      console.error("Error loading rooms", error);
      const errorMessage = error.response?.data?.message || "Failed to load rooms";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomName.trim()) {
      setMessage({ type: "error", text: "Please enter a room name" });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "info", text: "" });

    try {
      const res = await axios.post(
        "/api/clinic/rooms",
        { name: roomName.trim() },
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        setMessage({ type: "success", text: res.data.message || "Room created successfully" });
        setRoomName("");
        await loadRooms(); // Reload rooms list
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to create room" });
      }
    } catch (error: any) {
      console.error("Error creating room", error);
      const errorMessage = error.response?.data?.message || "Failed to create room";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room?")) {
      return;
    }

    try {
      const res = await axios.delete(`/api/clinic/rooms?roomId=${roomId}`, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setMessage({ type: "success", text: res.data.message || "Room deleted successfully" });
        await loadRooms(); // Reload rooms list
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to delete room" });
      }
    } catch (error: any) {
      console.error("Error deleting room", error);
      const errorMessage = error.response?.data?.message || "Failed to delete room";
      setMessage({ type: "error", text: errorMessage });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Manage Rooms</h1>
          <p className="text-sm text-gray-500">Create and manage rooms for your clinic.</p>
        </div>

        <MessageBanner type={message.type} text={message.text} />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Consultation Room 1, Operation Theater A"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Creating..." : "Create Room"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">All Rooms</h2>
            <p className="text-sm text-gray-500">List of all rooms in your clinic.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading rooms...
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
              🏥
            </div>
            <p className="text-gray-600">No rooms created yet.</p>
            <p className="text-sm text-gray-500 mt-2">Use the form above to create your first room.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room._id}
                className="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                  <p className="text-sm text-gray-500">
                    Created {new Date(room.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(room._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete room"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

AddRoomPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedAddRoomPage: NextPageWithLayout = withClinicAuth(AddRoomPage);
ProtectedAddRoomPage.getLayout = AddRoomPage.getLayout;

export default ProtectedAddRoomPage;

