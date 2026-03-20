import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type HeadersRecord = { [key: string]: string | undefined };

function currency(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return String(Math.round(n || 0));
  }
}

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

export default function AppointmentReport({ startDate, endDate, headers }: Props) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShowAppointments: 0 });
  const [doctorReport, setDoctorReport] = useState<any[]>([]);
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [doctorOptions, setDoctorOptions] = useState<any[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, doctorFilter, departmentFilter]);

  async function fetchData() {
    const qs = new URLSearchParams({
      startDate,
      endDate,
      ...(doctorFilter ? { doctorId: doctorFilter } : {}),
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    }).toString();
    const res = await fetch(`/api/clinic/reports/appointment-stats?${qs}`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setLeaderboard([]);
      setSummary({ totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShowAppointments: 0 });
      setDoctorReport([]);
      setDoctorOptions([]);
      setDepartmentOptions([]);
      return;
    }
    setLeaderboard(json.data?.leaderboard || []);
    setSummary(json.data?.summary || {});
    setDoctorReport(json.data?.doctorReport || []);
    setDoctorOptions(json.data?.filters?.doctors || []);
    setDepartmentOptions(json.data?.filters?.departments || []);
    setStatusCounts(json.data?.statusCounts || []);
  }

  const topDoctorsChart = useMemo(
    () =>
      (leaderboard || []).map((d: any) => ({
        name: d.doctorName || "Unknown",
        bookings: d.totalAppointments || 0,
      })),
    [leaderboard]
  );

  const revenueChart = useMemo(
    () =>
      (doctorReport || []).map((d: any) => ({
        name: d.doctorName || "Unknown",
        revenue: Math.round(d.revenue || 0),
        appointments: d.totalAppointments || 0,
      })),
    [doctorReport]
  );

  const statusChart = useMemo(
    () =>
      (Array.isArray(statusCounts) ? statusCounts : []).map((s: any) => ({
        name: s.status || "Unknown",
        count: s.count || 0,
      })),
    [statusCounts]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Doctor</label>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="">All</option>
            {doctorOptions.map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Department</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="">All</option>
            {departmentOptions.map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Top Doctors by Bookings</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDoctorsChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="bookings" fill="#2D9AA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Bookings by Status</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Appointment Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">Total Appointments</div>
            <div className="text-xl font-semibold">{summary.totalAppointments || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">Completed Appointments</div>
            <div className="text-xl font-semibold">{summary.completedAppointments || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">Cancelled Appointments</div>
            <div className="text-xl font-semibold">{summary.cancelledAppointments || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">No-show Patients</div>
            <div className="text-xl font-semibold">{summary.noShowAppointments || 0}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Doctor Appointment Report</h3>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Bar dataKey="revenue" fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Doctor Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Appointments</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {doctorReport.map((d) => (
                  <tr key={String(d.doctorId)}>
                    <td className="px-4 py-2 text-sm">{d.doctorName || "Unknown"}</td>
                    <td className="px-4 py-2 text-sm">{d.totalAppointments || 0}</td>
                    <td className="px-4 py-2 text-sm font-medium">{currency(d.revenue || 0)}</td>
                  </tr>
                ))}
                {!doctorReport.length && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>
                      No data for selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
