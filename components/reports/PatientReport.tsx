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
import ExportButtons from "./ExportButtons";

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

  const patientExportData = useMemo(() => {
    const visitedData = data.topVisited || [];
    const membershipData = data.membershipByPatient || [];
    const packageData = data.packageByPatient || [];
    const pendingData = data.highestPending || [];
    const advanceData = data.highestAdvance || [];
    const revenueData = data.revenueByPatient || [];

    // Get all unique patient IDs across all datasets
    const allPatientIds = Array.from(new Set([
      ...visitedData.map((p: any) => p.patientId),
      ...membershipData.map((p: any) => p.patientId),
      ...packageData.map((p: any) => p.patientId),
      ...pendingData.map((p: any) => p.patientId),
      ...advanceData.map((p: any) => p.patientId),
      ...revenueData.map((p: any) => p.patientId),
    ])).filter(id => id);

    const combined = allPatientIds.map((patientId: any) => {
      const visited = visitedData.find((p: any) => p.patientId === patientId);
      const membership = membershipData.find((p: any) => p.patientId === patientId);
      const pkg = packageData.find((p: any) => p.patientId === patientId);
      const pending = pendingData.find((p: any) => p.patientId === patientId);
      const advance = advanceData.find((p: any) => p.patientId === patientId);
      const revenue = revenueData.find((p: any) => p.patientId === patientId);

      const patientName = visited?.patientName || membership?.patientName || pkg?.patientName || 
                         pending?.patientName || advance?.patientName || revenue?.patientName || "Unknown";

      return {
        "Patient Name": patientName,
        "Total Visits": visited?.visits || 0,
        "Total Revenue (AED)": Math.round(revenue?.revenue || 0),
        "Membership Revenue (AED)": Math.round(membership?.membershipRevenue || 0),
        "Package Revenue (AED)": Math.round(pkg?.revenue || 0),
        "Pending Amount (AED)": Math.round(pending?.pending || 0),
        "Advance Amount (AED)": Math.round(advance?.advance || 0),
      };
    });

    // If no specific patient data, at least export the summary stats
    if (combined.length === 0 && data.summary) {
      return [{
        "Category": "Patient Summary",
        "Total Patients": data.summary.totalPatients || 0,
        "New Patients": data.summary.newPatients || 0,
        "Returning Patients": data.summary.returningPatients || 0,
      }];
    }

    return combined;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButtons
          data={patientExportData}
          filename={`patient_report_${startDate}_to_${endDate}`}
          headers={
            patientExportData.length > 0 && "Patient Name" in patientExportData[0]
              ? ["Patient Name", "Total Visits", "Total Revenue (AED)", "Membership Revenue (AED)", "Package Revenue (AED)", "Pending Amount (AED)", "Advance Amount (AED)"]
              : ["Category", "Total Patients", "New Patients", "Returning Patients"]
          }
          title="Patient Detailed Report"
        />
      </div>
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
