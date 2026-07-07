import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import ExportButtons from "./ExportButtons";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

type HeadersRecord = Record<string, string>;

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

interface Stats {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  releasedClaims: number;
  completedClaims: number;
  rejectedClaims: number;
  advanceClaims: number;
  totalClaimAmount: number;
  pendingClaimAmount: number;
}

interface DoctorClaims {
  doctorId: string;
  doctorName: string;
  claimsCount: number;
  totalClaimAmount: number;
  pendingClaims: number;
  approvedClaims: number;
  releasedClaims: number;
  completedClaims: number;
}

interface PatientClaims {
  patientId: string;
  patientName: string;
  patientMobile: string;
  totalClaims: number;
  pendingClaims: number;
  advanceClaims: number;
  totalAmount: number;
  pendingAmount: number;
  advanceAmount?: number;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0);
}

const STATUS_COLORS: Record<string, string> = {
  "Under Review": "#F59E0B",
  "Approved": "#10B981",
  "Released": "#6366F1",
  "Completed": "#2D9AA5",
  "Rejected": "#EF4444",
};

const TYPE_COLORS: Record<string, string> = {
  "Insurance": "#2D9AA5",
  "Advance": "#F59E0B",
  "Pending": "#6366F1",
};

export default function InsuranceClaimsReport({ startDate, endDate, headers }: Props) {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [topDoctors, setTopDoctors] = useState<DoctorClaims[]>([]);
  const [claimsByStatus, setClaimsByStatus] = useState<any[]>([]);
  const [claimsByType, setClaimsByType] = useState<any[]>([]);
  const [claimsByProvider, setClaimsByProvider] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [patientsWithPending, setPatientsWithPending] = useState<PatientClaims[]>([]);
  const [allPatients, setAllPatients] = useState<PatientClaims[]>([]);
  const [claimsByDepartment, setClaimsByDepartment] = useState<any[]>([]);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);

  const currencyFormatter = (n: number) => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatCurrency = (n: number) => currencyFormatter(n);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ startDate, endDate: new Date(endDate).toISOString() }).toString();
      const res = await fetch(`/api/clinic/reports/insurance-claims?${qs}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("Failed to fetch insurance claims report:", json.message);
        return;
      }
      const data = json.data;
      setStats(data.stats);
      setTopDoctors(data.topDoctors || []);
      setClaimsByStatus(data.claimsByStatus || []);
      setClaimsByType(data.claimsByType || []);
      setClaimsByProvider(data.claimsByProvider || []);
      setMonthlyTrend(data.monthlyTrend || []);
      setPatientsWithPending(data.patientsWithPending || []);
      setAllPatients(data.allPatients || []);
      setClaimsByDepartment(data.claimsByDepartment || []);
      setRecentClaims(data.recentClaims || []);
    } catch (err) {
      console.error("Error fetching insurance claims report:", err);
    } finally {
      setLoading(false);
    }
  }

  // Chart data
  const chartDoctors = useMemo(
    () => topDoctors.map(d => ({
      name: d.doctorName?.split(" ")[0] || "Dr.",
      fullName: d.doctorName,
      claims: d.claimsCount,
      amount: d.totalClaimAmount,
    })),
    [topDoctors]
  );

  const chartPatients = useMemo(
    () => allPatients.slice(0, 8).map(p => ({
      name: p.patientName.split(" ")[0] || "Patient",
      fullName: p.patientName,
      pending: p.pendingClaims,
      advance: p.advanceClaims,
      total: p.totalClaims,
    })),
    [allPatients]
  );

  const chartStatus = useMemo(
    () => claimsByStatus.map(s => ({
      name: s.status || "Unknown",
      value: s.count,
      amount: s.amount,
      color: STATUS_COLORS[s.status] || "#6B7280",
    })),
    [claimsByStatus]
  );

  const chartType = useMemo(
    () => claimsByType.map(t => ({
      name: t.type || "Unknown",
      value: t.count,
      amount: t.amount,
      color: TYPE_COLORS[t.type] || "#6B7280",
    })),
    [claimsByType]
  );

  const chartProvider = useMemo(
    () => claimsByProvider.slice(0, 6).map(p => ({
      name: p.provider?.substring(0, 15) || "Unknown",
      fullName: p.provider,
      count: p.count,
      amount: p.amount,
    })),
    [claimsByProvider]
  );

  // Export sections
  const exportSections = useMemo(() => [
    {
      title: "Overall Statistics",
      headers: ["Metric", "Value"],
      data: stats ? [
        { "Metric": "Total Claims", "Value": stats.totalClaims },
        { "Metric": "Pending Claims", "Value": stats.pendingClaims },
        { "Metric": "Approved Claims", "Value": stats.approvedClaims },
        { "Metric": "Released Claims", "Value": stats.releasedClaims },
        { "Metric": "Completed Claims", "Value": stats.completedClaims },
        { "Metric": "Rejected Claims", "Value": stats.rejectedClaims },
        { "Metric": "Advance Claims", "Value": stats.advanceClaims },
        { "Metric": `Total Claim Amount (${currency})`, "Value": Math.round(stats.totalClaimAmount) },
        { "Metric": `Pending Claim Amount (${currency})`, "Value": Math.round(stats.pendingClaimAmount) },
      ] : [],
    },
    {
      title: "Top 5 Doctors by Claims",
      headers: ["Doctor", "Claims Count", `Total Amount (${currency})`, "Pending", "Approved", "Released", "Completed"],
      data: topDoctors.map(d => ({
        "Doctor": d.doctorName,
        "Claims Count": d.claimsCount,
        [`Total Amount (${currency})`]: Math.round(d.totalClaimAmount),
        "Pending": d.pendingClaims,
        "Approved": d.approvedClaims,
        "Released": d.releasedClaims,
        "Completed": d.completedClaims,
      })),
    },
    {
      title: "Claims by Status",
      headers: ["Status", "Count", `Amount (${currency})`],
      data: claimsByStatus.map(s => ({
        "Status": s.status,
        "Count": s.count,
        [`Amount (${currency})`]: Math.round(s.amount),
      })),
    },
    {
      title: "Claims by Type",
      headers: ["Type", "Count", `Amount (${currency})`],
      data: claimsByType.map(t => ({
        "Type": t.type,
        "Count": t.count,
        [`Amount (${currency})`]: Math.round(t.amount),
      })),
    },
    {
      title: "Patients with Pending/Advance Claims",
      headers: ["Patient", "Mobile", "Total Claims", "Pending", "Advance", `Total Amount (${currency})`, `Pending Amount (${currency})`],
      data: patientsWithPending.map(p => ({
        "Patient": p.patientName,
        "Mobile": p.patientMobile,
        "Total Claims": p.totalClaims,
        "Pending": p.pendingClaims,
        "Advance": p.advanceClaims,
        [`Total Amount (${currency})`]: Math.round(p.totalAmount),
        [`Pending Amount (${currency})`]: Math.round(p.pendingAmount),
      })),
    },
    {
      title: "All Patients Claims Summary",
      headers: ["Patient", "Mobile", "Total Claims", "Pending", "Advance", `Total Amount (${currency})`],
      data: allPatients.map(p => ({
        "Patient": p.patientName,
        "Mobile": p.patientMobile,
        "Total Claims": p.totalClaims,
        "Pending": p.pendingClaims,
        "Advance": p.advanceClaims,
        [`Total Amount (${currency})`]: Math.round(p.totalAmount),
      })),
    },
    {
      title: "Claims by Department",
      headers: ["Department", "Count", `Amount (${currency})`],
      data: claimsByDepartment.map(d => ({
        "Department": d.department,
        "Count": d.count,
        [`Amount (${currency})`]: Math.round(d.amount),
      })),
    },
    {
      title: "Claims by Insurance Provider",
      headers: ["Provider", "Count", `Amount (${currency})`],
      data: claimsByProvider.map(p => ({
        "Provider": p.provider,
        "Count": p.count,
        [`Amount (${currency})`]: Math.round(p.amount),
      })),
    },
  ], [stats, topDoctors, claimsByStatus, claimsByType, patientsWithPending, allPatients, claimsByDepartment, claimsByProvider, currency]);

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButtons
          sections={exportSections}
          filename={`insurance_claims_report_${startDate}_to_${endDate}`}
          title="Insurance Claims Report"
        />
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">Loading claims data...</span>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl p-4 text-white shadow-lg">
            <div className="text-xs font-medium opacity-80">Total Claims</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats.totalClaims)}</div>
            <div className="text-xs opacity-70 mt-1">All time in period</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl p-4 text-white shadow-lg">
            <div className="text-xs font-medium opacity-80">Pending</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats.pendingClaims)}</div>
            <div className="text-xs opacity-70 mt-1">{formatCurrency(stats.pendingClaimAmount)}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-4 text-white shadow-lg">
            <div className="text-xs font-medium opacity-80">Approved</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats.approvedClaims)}</div>
            <div className="text-xs opacity-70 mt-1">Ready to release</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-4 text-white shadow-lg">
            <div className="text-xs font-medium opacity-80">Released</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats.releasedClaims)}</div>
            <div className="text-xs opacity-70 mt-1">Awaiting completion</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl p-4 text-white shadow-lg">
            <div className="text-xs font-medium opacity-80">Completed</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats.completedClaims)}</div>
            <div className="text-xs opacity-70 mt-1">Fully settled</div>
          </div>
        </div>
      )}

      {/* Total Amount Card */}
      {stats && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">Total Claim Amount</div>
                <div className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalClaimAmount)}</div>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{formatNumber(stats.advanceClaims)}</div>
                <div className="text-xs text-gray-500">Advance Claims</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatNumber(stats.rejectedClaims)}</div>
                <div className="text-xs text-gray-500">Rejected</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1: Top Doctors Bar Chart & Status Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Doctors Bar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Top 5 Doctors by Claims</h3>
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">Claims Count</span>
          </div>
          <div style={{ height: 320 }}>
            {chartDoctors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDoctors} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip 
                    formatter={(value: any) => formatNumber(value)}
                    labelFormatter={(label) => chartDoctors.find(d => d.name === label)?.fullName || label}
                  />
                  <Bar dataKey="claims" fill="#2D9AA5" radius={[4, 4, 0, 0]} name="Claims" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Claims by Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Claims by Status</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Distribution</span>
          </div>
          <div style={{ height: 320 }}>
            {chartStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatNumber(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Patients with Pending Claims & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patients with Pending/Advance Claims */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Patients with Pending/Advance Claims</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">By Patient</span>
          </div>
          <div style={{ height: 320 }}>
            {chartPatients.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPatients} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: any) => formatNumber(value)}
                    labelFormatter={(label: any) => chartPatients.find(p => p.name === label)?.fullName || String(label)}
                  />
                  <Legend />
                  <Bar dataKey="pending" stackId="a" fill="#F59E0B" name="Pending" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="advance" stackId="a" fill="#EF4444" name="Advance" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Monthly Claims Trend</h3>
            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">Last 6 Months</span>
          </div>
          <div style={{ height: 320 }}>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(value: any) => formatNumber(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#2D9AA5" strokeWidth={3} dot={{ r: 4 }} name="Claims Count" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 3: Claims by Type & By Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claims by Type */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Claims by Type</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Breakdown</span>
          </div>
          <div style={{ height: 300 }}>
            {chartType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartType}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatNumber(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Claims by Provider */}
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Claims by Insurance Provider</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Top 6</span>
          </div>
          <div style={{ height: 300 }}>
            {chartProvider.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartProvider} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: any) => formatNumber(value)}
                    labelFormatter={(label: any) => chartProvider.find(p => p.name === label)?.fullName || String(label)}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} name="Claims" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Doctors Table */}
      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Top Doctors Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Doctor Name</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Total Claims</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Pending</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Approved</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Released</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {topDoctors.length > 0 ? topDoctors.map((doctor, index) => (
                <tr key={doctor.doctorId} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{doctor.doctorName}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-teal-600">{doctor.claimsCount}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(doctor.totalClaimAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {doctor.pendingClaims}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {doctor.approvedClaims}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {doctor.releasedClaims}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                      {doctor.completedClaims}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={8}>
                    No doctor claims data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patients with Pending/Advance Claims Table */}
      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Patients with Pending/Advance Claims</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Patient Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Total Claims</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Pending Claims</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Advance Claims</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Pending Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {patientsWithPending.length > 0 ? patientsWithPending.map((patient, index) => (
                <tr key={patient.patientId} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.patientName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{patient.patientMobile || "-"}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-teal-600">{patient.totalClaims}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {patient.pendingClaims}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {patient.advanceClaims}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(patient.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-amber-600">{formatCurrency(patient.pendingAmount)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={7}>
                    No patients with pending or advance claims for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Patients Summary Table */}
      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">All Patients Claims Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Patient Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Total Claims</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Pending</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Advance</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {allPatients.length > 0 ? allPatients.map((patient, index) => (
                <tr key={patient.patientId} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.patientName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{patient.patientMobile || "-"}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-teal-600">{patient.totalClaims}</td>
                  <td className="px-4 py-3 text-center">
                    {patient.pendingClaims > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {patient.pendingClaims}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {patient.advanceClaims > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {patient.advanceClaims}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(patient.totalAmount)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={6}>
                    No patient claims data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claims by Department */}
      {claimsByDepartment.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Claims by Department</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {claimsByDepartment.map((dept, index) => (
              <div key={dept.department} className={`rounded-lg p-4 ${index % 2 === 0 ? "bg-teal-50" : "bg-gray-50"}`}>
                <div className="text-xs text-gray-500 font-medium truncate">{dept.department || "Unknown"}</div>
                <div className="text-xl font-bold text-gray-900 mt-1">{dept.count}</div>
                <div className="text-xs text-gray-500 mt-1">{formatCurrency(dept.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Claims */}
      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Claims</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Provider</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {recentClaims.length > 0 ? recentClaims.map((claim, index) => (
                <tr key={claim.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{claim.patientName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{claim.doctorName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[150px]">{claim.provider}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      claim.claimType === "Advance" ? "bg-red-100 text-red-800" : "bg-teal-100 text-teal-800"
                    }`}>
                      {claim.claimType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      claim.status === "Completed" ? "bg-green-100 text-green-800" :
                      claim.status === "Approved" ? "bg-blue-100 text-blue-800" :
                      claim.status === "Released" ? "bg-purple-100 text-purple-800" :
                      claim.status === "Rejected" ? "bg-red-100 text-red-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(claim.claimAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500 text-center" colSpan={7}>
                    No recent claims for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}