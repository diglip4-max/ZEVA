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

export default function PatientReport({ startDate, endDate, headers }: Props) {
  const [data, setData] = useState<any>({
    topVisited: [],
    membershipByPatient: [],
    packageByPatient: [],
    highestPending: [],
    highestAdvance: [],
    revenueByPatient: [],
    summary: { totalPatients: 0, newPatients: 0, returningPatients: 0 },
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    const res = await fetch(`/api/clinic/reports/patient-stats?${qs}`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setData({
        topVisited: [],
        membershipByPatient: [],
        packageByPatient: [],
        highestPending: [],
        highestAdvance: [],
        revenueByPatient: [],
        summary: { totalPatients: 0, newPatients: 0, returningPatients: 0 },
      });
      return;
    }
    setData(json.data || {});
  }

  const visitedChart = useMemo(
    () =>
      (data.topVisited || []).slice(0, 10).map((r: any) => ({
        name: r.patientName || "Unknown",
        visits: r.visits || 0,
      })),
    [data.topVisited]
  );

  const membershipChart = useMemo(
    () =>
      (data.membershipByPatient || []).slice(0, 10).map((r: any) => ({
        name: r.patientName || "Unknown",
        revenue: Math.round(r.membershipRevenue || 0),
        count: r.count || 0,
      })),
    [data.membershipByPatient]
  );

  const packageChart = useMemo(
    () =>
      (data.packageByPatient || []).slice(0, 10).map((r: any) => ({
        name: r.patientName || "Unknown",
        revenue: Math.round(r.revenue || 0),
        count: r.count || 0,
      })),
    [data.packageByPatient]
  );

  const revenueChart = useMemo(
    () =>
      (data.revenueByPatient || []).slice(0, 10).map((r: any) => ({
        name: r.patientName || "Unknown",
        revenue: Math.round(r.revenue || 0),
      })),
    [data.revenueByPatient]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Most Visited Patients</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visitedChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visits" fill="#2D9AA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Top Membership Purchases</h3>
          </div>
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={membershipChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Bar dataKey="revenue" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Top Package Purchases</h3>
          </div>
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packageChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Bar dataKey="revenue" fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Patient Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">Total Patients</div>
            <div className="text-xl font-semibold">{data.summary?.totalPatients || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">New Patients</div>
            <div className="text-xl font-semibold">{data.summary?.newPatients || 0}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-xs text-gray-500">Returning Patients</div>
            <div className="text-xl font-semibold">{data.summary?.returningPatients || 0}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Highest Pending Amount</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Pending</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(data.highestPending || []).slice(0, 10).map((r: any) => (
                  <tr key={String(r.patientId)}>
                    <td className="px-4 py-2 text-sm">{r.patientName || "Unknown"}</td>
                    <td className="px-4 py-2 text-sm font-medium">{currency(r.pending || 0)}</td>
                  </tr>
                ))}
                {!data.highestPending?.length && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500" colSpan={2}>
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Highest Advance Amount</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Patient Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Advance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(data.highestAdvance || []).slice(0, 10).map((r: any) => (
                  <tr key={String(r.patientId)}>
                    <td className="px-4 py-2 text-sm">{r.patientName || "Unknown"}</td>
                    <td className="px-4 py-2 text-sm font-medium">{currency(r.advance || 0)}</td>
                  </tr>
                ))}
                {!data.highestAdvance?.length && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500" colSpan={2}>
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Top Patients by Revenue</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Bar dataKey="revenue" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
