import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
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

type RevenueDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  service: string;
  packageName: string;
  treatmentName: string;
  invoiceNumber: string;
  invoicedDate: string;
  amount: number;
  paid: number;
  pending: number;
  advance: number;
  packageAmount?: number;
  selectedTreatments?: Array<{
    treatmentName: string;
    price: number;
    quantity: number;
    total: number;
  }>;
};

type RevenueRow = { staffId: string; staffName: string; revenue: number; invoices: number; details: RevenueDetail[] };
type RevenueApiDoctorRow = { doctorId: string; name: string; amount: number; details: RevenueDetail[] };
type RevenueApiStaffRow = { staffId: string; name: string; amount: number; invoices?: number; details: RevenueDetail[] };
type DetailRow = {
  staffId: string;
  staffName: string;
  totalAppointments: number;
  booked: number;
  cancelled: number;
  completed: number;
  invoiced: number;
  rescheduled: number;
  totalPatients: number;
};

type PackageDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  amount: number;
  paid: number;
  pending: number;
  advance: number;
  packageName: string;
  invoiceNumber: string;
  invoicedDate: string;
};

type MembershipDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  service: string;
  packageName: string;
  treatmentName: string;
  invoiceNumber: string;
  invoicedDate: string;
  amount: number;
  paid: number;
  pending: number;
  advance: number;
  isFreeConsultation: boolean;
  membershipDiscountApplied: number;
};

type BillingRow = {
  staffId: string;
  name: string;
  amount: number;
  count: number;
  details: PackageDetail[];
};

type MembershipBillingRow = {
  staffId: string;
  name: string;
  amount: number;
  count: number;
  details: MembershipDetail[];
};

type CommissionDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  invoiceNumber: string;
  invoicedDate: string;
  amountPaid: number;
  finalCommissionAmount?: number;
  commissionAmount: number;
  totalAmount: number;
  paid: number;
  pending: number;
  advance: number;
};

type CommissionRow = {
  staffId: string;
  name: string;
  totalCommission: number;
  entries: number;
  details: CommissionDetail[];
};

export default function DoctorStaffReport({ startDate, endDate, headers }: Props) {
  const { currency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'doctor' | 'sales'>('doctor');
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [agentRevenues, setAgentRevenues] = useState<RevenueRow[]>([]);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [topDoctorStaffCommission, setTopDoctorStaffCommission] = useState<CommissionRow[]>([]);
  const [topAgentCommission, setTopAgentCommission] = useState<CommissionRow[]>([]);
  const [topPackageBilling, setTopPackageBilling] = useState<BillingRow[]>([]);
  const [topMembershipBilling, setTopMembershipBilling] = useState<MembershipBillingRow[]>([]);
  const [selectedPackageStaff, setSelectedPackageStaff] = useState<BillingRow | null>(null);
  const [selectedRevenueStaff, setSelectedRevenueStaff] = useState<RevenueRow | null>(null);
  const [selectedMembershipStaff, setSelectedMembershipStaff] = useState<MembershipBillingRow | null>(null);
  const [selectedDoctorStaffCommission, setSelectedDoctorStaffCommission] = useState<CommissionRow | null>(null);
  const [selectedAgentCommission, setSelectedAgentCommission] = useState<CommissionRow | null>(null);

  const currencyFormatter = (n: number | null | undefined) => {
    const symbol = getCurrencySymbol(currency);
    const value = n ?? 0;
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatCurrency = (n: number | null | undefined) => currencyFormatter(n);

  useEffect(() => {
    // Load supporting doctor-staff data plus the canonical doctor/staff revenue used in Revenue Report.
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const doctorStaffQs = new URLSearchParams({ startDate, endDate: new Date(endDate).toISOString() }).toString();
      const revenueQs = new URLSearchParams({ startDate, endDate }).toString();
      const [doctorStaffRes, revenueRes] = await Promise.all([
        fetch(`/api/clinic/reports/doctor-staff-performance?${doctorStaffQs}`, { headers }),
        fetch(`/api/clinic/reports/revenue?${revenueQs}`, { headers }),
      ]);
      const [doctorStaffJson, revenueJson] = await Promise.all([
        doctorStaffRes.json(),
        revenueRes.json(),
      ]);

      if (!doctorStaffRes.ok || !doctorStaffJson.success) {
        setRevenues([]);
        setAgentRevenues([]);
        setDetails([]);
        setTopDoctorStaffCommission([]);
        setTopAgentCommission([]);
        setTopPackageBilling([]);
        setTopMembershipBilling([]);
      } else {
        console.log("top5Revenue:", doctorStaffJson.data?.top5Revenue);
        console.log("top5AgentRevenue:", doctorStaffJson.data?.top5AgentRevenue);
        console.log("DEBUG - directBillingAggCount:", doctorStaffJson.data?.debug?.directBillingAggCount);
        console.log("DEBUG - directBillingAggData:", doctorStaffJson.data?.debug?.directBillingAggData);
        console.log("DEBUG - revenueByAgentCount:", doctorStaffJson.data?.debug?.revenueByAgentCount);
        console.log("DEBUG - revenueByAgentData:", JSON.stringify(doctorStaffJson.data?.debug?.revenueByAgentData, null, 2));
        console.log("DEBUG - agentRevenues state:", doctorStaffJson.data?.top5AgentRevenue);
        setDetails(doctorStaffJson.data?.top5Details || []);
        setTopDoctorStaffCommission(doctorStaffJson.data?.topDoctorStaffCommission || []);
        setTopAgentCommission(doctorStaffJson.data?.topAgentCommission || []);
        setTopPackageBilling(doctorStaffJson.data?.topPackageBilling || []);
        setTopMembershipBilling(doctorStaffJson.data?.topMembershipBilling || []);
      }

      if (!revenueRes.ok || !revenueJson.success) {
        setRevenues([]);
        setAgentRevenues([]);
      } else {
        const doctorRevenueRows: RevenueRow[] = ((revenueJson.data?.revenueByDoctor || []) as RevenueApiDoctorRow[])
          .map((row) => ({
            staffId: row.doctorId || "",
            staffName: row.name || "Unknown",
            revenue: Math.round(Number(row.amount || 0)),
            invoices: Array.isArray(row.details) ? row.details.length : 0,
            details: row.details || [],
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const staffRevenueRows: RevenueRow[] = ((revenueJson.data?.revenueByStaff || []) as RevenueApiStaffRow[])
          .map((row) => ({
            staffId: row.staffId || "",
            staffName: row.name || "Unknown",
            revenue: Math.round(Number(row.amount || 0)),
            invoices: row.invoices ?? (Array.isArray(row.details) ? row.details.length : 0),
            details: row.details || [],
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setRevenues(doctorRevenueRows);
        setAgentRevenues(staffRevenueRows);
      }
    } finally {
      setLoading(false);
    }
  }

  // Use appropriate revenue data based on active tab
  const currentRevenues = activeTab === 'doctor' ? revenues : agentRevenues;

  const chartBookings = useMemo(
    () =>
      (currentRevenues || []).map((r) => ({
        name: r.staffName || "Unknown",
        value: Math.round(r.revenue || 0),
      })),
    [currentRevenues]
  );

  const chartRevenue = useMemo(() => {
    const maxRevenue = Math.max(...currentRevenues.map((r) => r.revenue));
    return (currentRevenues || []).map((d) => ({
      name: d.staffName || "Unknown",
      revenue: Math.round(d.revenue || 0),
      normalizedRevenue: maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0,
    }));
  }, [currentRevenues]);

  const chartPatients = useMemo(
    () =>
      (details || []).map((d) => ({
        name: d.staffName || "Unknown",
        patients: d.totalPatients || 0,
      })),
    [details]
  );

  const doctorStaffExportSections = useMemo(() => [
    {
      title: activeTab === "doctor" ? "Revenue by Doctor" : "Revenue by Staff (Direct Billings)",
      headers: [activeTab === "doctor" ? "Doctor" : "Staff/Agent", `Revenue (${currency})`, "Invoices"],
      data: currentRevenues.map((r) => ({
        [activeTab === "doctor" ? "Doctor" : "Staff/Agent"]: r.staffName || "Unknown",
        [`Revenue (${currency})`]: Math.round(r.revenue || 0),
        "Invoices": r.invoices || 0,
      })),
    },
    {
      title: activeTab === "doctor" ? "Top 5 Doctor Staff Revenue" : "Top 5 Staff Revenue (Direct Billings)",
      headers: [activeTab === "doctor" ? "Doctor Staff" : "Staff/Agent", `Revenue (${currency})`, "Invoices"],
      data: currentRevenues.map(r => ({
        [activeTab === "doctor" ? "Doctor Staff" : "Staff/Agent"]: r.staffName || "Unknown",
        [`Revenue (${currency})`]: Math.round(r.revenue || 0),
        "Invoices": r.invoices || 0,
      })),
    },
    {
      title: "Highest Billing in Packages",
      headers: ["Doctor Staff", `Package Revenue (${currency})`, "Invoices"],
      data: topPackageBilling.map(r => ({
        "Doctor Staff": r.name || "Unknown",
        [`Package Revenue (${currency})`]: Math.round(r.amount || 0),
        "Invoices": r.count || 0,
      })),
    },
    {
      title: "Highest Billing in Memberships",
      headers: ["Doctor Staff", `Membership Revenue (${currency})`, "Invoices"],
      data: topMembershipBilling.map(r => ({
        "Doctor Staff": r.name || "Unknown",
        [`Membership Revenue (${currency})`]: Math.round(r.amount || 0),
        "Invoices": r.count || 0,
      })),
    },
    {
      title: "Top 5 Doctor Staff Commission",
      headers: ["Doctor Staff", `Total Commission (${currency})`, "Entries"],
      data: topDoctorStaffCommission.map(r => ({
        "Doctor Staff": r.name || "Unknown",
        [`Total Commission (${currency})`]: Math.round(r.totalCommission || 0),
        "Entries": r.entries || 0,
      })),
    },
    {
      title: "Top 5 Agents Commission",
      headers: ["Agent", `Total Commission (${currency})`, "Entries"],
      data: topAgentCommission.map(r => ({
        "Agent": r.name || "Unknown",
        [`Total Commission (${currency})`]: Math.round(r.totalCommission || 0),
        "Entries": r.entries || 0,
      })),
    },
  ], [activeTab, currentRevenues, topPackageBilling, topMembershipBilling, topDoctorStaffCommission, topAgentCommission, currency]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('doctor')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'doctor' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Doctor
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Sales Staff
          </button>
        </div>
        {activeTab === 'doctor' && (
          <ExportButtons
            title="Doctor Staff Report"
            filename="doctor-staff-report"
            sections={doctorStaffExportSections}
          />
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {activeTab === 'doctor' ? 'Doctor Staff by Revenue' : 'Revenue by Staff (Direct Billings)'}
          </h3>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartBookings} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
              <Bar dataKey="value" fill="#2D9AA5" name={`Revenue (${currency})`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {activeTab === 'doctor' ? 'Top 5 Doctor Staff Revenue' : 'Top 5 Staff Revenue (Direct Billings)'}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v || 0))} />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={`Revenue (${currency})`}
                  stroke="#0EA5E9"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0EA5E9", strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="normalizedRevenue"
                  name="Normalized Revenue (%)"
                  stroke="#8884d8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#8884d8" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {activeTab === 'doctor' ? 'Doctor Staff' : 'Staff/Agent'}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Invoices</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {currentRevenues.map((r) => (
                  <tr key={r.staffId}>
                    <td className="px-4 py-2 text-sm">{r.staffName}</td>
                    <td className="px-4 py-2 text-sm font-medium">{formatCurrency(r.revenue)}</td>
                    <td className="px-4 py-2 text-sm">{r.invoices}</td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => setSelectedRevenueStaff(r)}
                        className="text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!currentRevenues.length && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500" colSpan={4}>
                      No revenue data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Highest Billing in Packages</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Doctor Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Package Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoices</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">View</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {topPackageBilling.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.count}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                    <button
                      onClick={() => setSelectedPackageStaff(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!topPackageBilling.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-700" colSpan={4}>
                    No package billing data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for package details */}
      {selectedPackageStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Package Billing Details - {selectedPackageStaff.name}</h2>
              <button
                onClick={() => setSelectedPackageStaff(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Patient Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">EMR No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Package Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Paid</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedPackageStaff.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <button
                          onClick={() => router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {(detail.patientName || "").trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Package</span>
                          <span>{detail.packageName || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.invoicedDate ? new Date(detail.invoicedDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.amount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900" colSpan={5}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">
                      {formatCurrency(selectedPackageStaff.details.reduce((sum, d) => sum + Number(d.amount || 0), 0))}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">{formatCurrency(selectedPackageStaff.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal for revenue details */}
      {selectedRevenueStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {activeTab === 'doctor' ? 'Doctor Revenue Details' : 'Agent/Staff Revenue Details'} - {selectedRevenueStaff.staffName}
              </h2>
              <button
                onClick={() => setSelectedRevenueStaff(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Patient Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">EMR No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Service/Package</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Paid</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedRevenueStaff.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <button
                          onClick={() => router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {(detail.patientName || "").trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.service === "Package" ? (
                          <div className="flex flex-col gap-1">
                            {/* Show package portion */}
                            {detail.packageAmount !== undefined && detail.packageAmount > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Package</span>
                                <span>{detail.packageName || "Package"}</span>
                                <span className="text-xs text-gray-500">({formatCurrency(detail.packageAmount)})</span>
                              </div>
                            )}
                            {/* Show treatment breakdown if available */}
                            {detail.selectedTreatments && detail.selectedTreatments.length > 0 && (
                              <>
                                {detail.selectedTreatments.map((t: any, tIdx: number) => (
                                  <div key={tIdx} className="flex items-center gap-2 ml-4">
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Treatment</span>
                                    <span>{t.treatmentName}</span>
                                    <span className="text-xs text-gray-500">({formatCurrency(t.total)})</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {/* Fallback for regular package billings */}
                            {!detail.packageAmount && (!detail.selectedTreatments || detail.selectedTreatments.length === 0) && (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Package</span>
                                <span>{detail.packageName || "Package"}</span>
                              </div>
                            )}
                          </div>
                        ) : detail.service === "Treatment" ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Treatment</span>
                            <span>{detail.treatmentName || detail.service || "Treatment"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">{detail.service || "Service"}</span>
                            <span>{detail.treatmentName || detail.service || "Service"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.invoicedDate ? new Date(detail.invoicedDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.amount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900" colSpan={5}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">
                      {formatCurrency(selectedRevenueStaff.details.reduce((sum, d) => sum + Number(d.amount || 0), 0))}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">{formatCurrency(selectedRevenueStaff.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal for membership details */}
      {selectedMembershipStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Membership Billing Details - {selectedMembershipStaff.name}</h2>
              <button
                onClick={() => setSelectedMembershipStaff(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Patient Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">EMR No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Service</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Paid</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedMembershipStaff.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <button
                          onClick={() => router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {(detail.patientName || "").trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">Membership</span>
                          <span>
                            {detail.isFreeConsultation
                              ? "Free Consultation"
                              : detail.treatmentName || detail.packageName || detail.service || "Service"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.invoicedDate ? new Date(detail.invoicedDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.amount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900" colSpan={5}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">
                      {formatCurrency(selectedMembershipStaff.details.reduce((sum, d) => sum + Number(d.amount || 0), 0))}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">{formatCurrency(selectedMembershipStaff.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Highest Billing in Memberships</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Doctor Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Membership Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoices</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {topMembershipBilling.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.count}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                    <button
                      onClick={() => setSelectedMembershipStaff(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!topMembershipBilling.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-700" colSpan={4}>
                    No membership billing data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Total Patients Treated (Top 5)</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartPatients} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)} />
              <Tooltip />
              <Bar dataKey="patients" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 5 Doctor Staff Commission</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Doctor Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Commission</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Entries</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {topDoctorStaffCommission.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(r.totalCommission)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.entries}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                    <button
                      onClick={() => setSelectedDoctorStaffCommission(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!topDoctorStaffCommission.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-700" colSpan={4}>
                    No commission data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 5 Agents Commission</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Agent</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Commission</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Entries</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {topAgentCommission.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(r.totalCommission)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{r.entries}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                    <button
                      onClick={() => setSelectedAgentCommission(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!topAgentCommission.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-700" colSpan={4}>
                    No commission data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for doctor staff commission details */}
      {selectedDoctorStaffCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Doctor Staff Commission Details - {selectedDoctorStaffCommission.name}</h2>
              <button
                onClick={() => setSelectedDoctorStaffCommission(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Patient Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">EMR No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Commission</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedDoctorStaffCommission.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <button
                          onClick={() => router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {(detail.patientName || "").trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.invoicedDate ? new Date(detail.invoicedDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.totalAmount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.paid)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.finalCommissionAmount ?? detail.commissionAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900" colSpan={6}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">{formatCurrency(selectedDoctorStaffCommission.totalCommission)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal for agent commission details */}
      {selectedAgentCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Agent Commission Details - {selectedAgentCommission.name}</h2>
              <button
                onClick={() => setSelectedAgentCommission(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Patient Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">EMR No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Total Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider dark:text-gray-800">Commission</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedAgentCommission.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        <button
                          onClick={() => router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {(detail.patientName || "").trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-900">
                        {detail.invoicedDate ? new Date(detail.invoicedDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.totalAmount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.paid)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-900">{formatCurrency(detail.finalCommissionAmount ?? detail.commissionAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900" colSpan={6}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-900">{formatCurrency(selectedAgentCommission.totalCommission)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
