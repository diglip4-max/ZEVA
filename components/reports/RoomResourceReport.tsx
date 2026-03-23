import React, { useEffect, useMemo, useState } from "react";
import ExportButtons from "./ExportButtons";

type HeadersRecord = { [key: string]: string | undefined };

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

type RoomRow = {
  roomId: string;
  roomName: string;
  totalBookings: number;
};

export default function RoomResourceReport({ startDate, endDate, headers }: Props) {
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [top5Rooms, setTop5Rooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ startDate, endDate }).toString();
      const res = await fetch(`/api/clinic/reports/room-resource?${qs}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRooms([]);
        setTop5Rooms([]);
        return;
      }
      setRooms(json.data?.rooms || []);
      setTop5Rooms(json.data?.top5Rooms || []);
    } finally {
      setLoading(false);
    }
  }

  const sliderItems = useMemo(
    () =>
      (top5Rooms || []).map((r) => ({
        id: r.roomId,
        name: r.roomName || "Unknown",
        count: r.totalBookings || 0,
      })),
    [top5Rooms]
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <ExportButtons
          data={rooms.map((r) => ({
            "Room Name": r.roomName || "Unknown",
            "Total Bookings": r.totalBookings || 0,
          }))}
          filename={`room_report_${startDate}_to_${endDate}`}
          headers={["Room Name", "Total Bookings"]}
          title="Room Bookings Report"
        />
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Room Bookings</h3>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Room Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Bookings</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rooms.map((r) => (
                <tr key={r.roomId}>
                  <td className="px-4 py-2 text-sm">{r.roomName}</td>
                  <td className="px-4 py-2 text-sm font-medium">{r.totalBookings}</td>
                </tr>
              ))}
              {!rooms.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500" colSpan={2}>
                    No room bookings for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 5 Highest Booking Rooms</h3>
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2">
            {sliderItems.map((item) => (
              <div
                key={item.id}
                className="min-w-[220px] snap-start bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm"
              >
                <div className="text-sm text-gray-500">Room</div>
                <div className="text-lg font-semibold text-gray-800">{item.name}</div>
                <div className="mt-2 text-sm text-gray-600">Total Bookings</div>
                <div className="text-2xl font-bold text-[#2D9AA5]">{item.count}</div>
              </div>
            ))}
            {!sliderItems.length && (
              <div className="text-sm text-gray-500 px-2">No data for selected period</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
