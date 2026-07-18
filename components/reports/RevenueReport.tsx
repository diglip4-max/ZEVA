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

type DoctorDetail = {
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
  advanceUsed: number;
  claimAmountUsed: number;
  cashbackWalletUsed: number;
  pendingUsed: number;
  pendingClaimUsed: number;
  packageAmount?: number;
  selectedTreatments?: Array<{
    treatmentName: string;
    price: number;
    quantity: number;
    total: number;
  }>;
};

type DoctorRow = {
  doctorId: string;
  name: string;
  amount: number;
  details: DoctorDetail[];
};
type StaffRow = {
  staffId: string;
  name: string;
  amount: number;
  invoices: number;
  details: DoctorDetail[];
};
type ServiceDetail = {
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
  pendingUsed: number;
  pendingClaimUsed: number;
  advanceUsed: number;
  claimAmountUsed: number;
  cashbackWalletUsed: number;
};
type ServiceRow = { serviceId: string; name: string; amount: number; details: ServiceDetail[] };
type PackageDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  service: string;
  packageName: string;
  treatmentName: string;
  invoiceNumber: string;
  invoicedDate: string;
  packageSoldBy: string;
  amount: number;
  paid: number;
  pending: number;
  advance: number;
  pendingUsed: number;
  pendingClaimUsed: number;
  advanceUsed: number;
  claimAmountUsed: number;
  cashbackWalletUsed: number;
};
type PackageRow = { packageName: string; amount: number; details: PackageDetail[] };
type DepartmentDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  service: string;
  packageName: string;
  treatmentName: string;
  invoiceNumber: string;
  invoicedDate: string;
  totalAmount: number;
  revenue: number;
};
type DepartmentRow = { departmentId: string; name: string; amount: number; details: DepartmentDetail[] };
type PaymentMethodDetail = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  service: string;
  treatment: string;
  package: string;
  invoiceNumber: string;
  invoicedDate: string;
  totalAmount: number;
  revenue: number;
};
type PaymentRow = { method: string; amount: number; details: PaymentMethodDetail[] };
type ViewRow = { label: string; amount: number };

export default function RevenueReport({ startDate, endDate, headers }: Props) {
  const { currency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [treatmentRevenue, setTreatmentRevenue] = useState(0);
  const [packageRevenue, setPackageRevenue] = useState(0);
  const [advanceRevenue, setAdvanceRevenue] = useState(0);
  const [pendingCleared, setPendingCleared] = useState(0);
  const [revenueByDoctor, setRevenueByDoctor] = useState<DoctorRow[]>([]);
  const [revenueByStaff, setRevenueByStaff] = useState<StaffRow[]>([]);
  const [revenueByService, setRevenueByService] = useState<ServiceRow[]>([]);
  const [revenueByPackage, setRevenueByPackage] = useState<PackageRow[]>([]);
  const [revenueByDepartment, setRevenueByDepartment] = useState<DepartmentRow[]>([]);
  const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState<PaymentRow[]>([]);
  const [daily, setDaily] = useState<ViewRow[]>([]);
  const [weekly, setWeekly] = useState<ViewRow[]>([]);
  const [monthly, setMonthly] = useState<ViewRow[]>([]);
  const [yearly, setYearly] = useState<ViewRow[]>([]);

  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize] = useState(10);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [pendingFilter, setPendingFilter] = useState<"pending" | "advance">("pending");
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize] = useState(10);
  const [pendingTotal, setPendingTotal] = useState(0);
  type TopPatientRow = { patientId: string; name: string; amount: number };
  const [topPendingPatients, setTopPendingPatients] = useState<TopPatientRow[]>([]);
  const [topAdvancePatients, setTopAdvancePatients] = useState<TopPatientRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRow | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageRow | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentRow | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentRow | null>(null);

  const currencyFormatter = (n: number | null | undefined) => {
    const symbol = getCurrencySymbol(currency);
    const value = n ?? 0;
    return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const fmtCurrency = (n: number | null | undefined) => currencyFormatter(n);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, paymentsPage, paymentsPageSize, pendingFilter, pendingPage, pendingPageSize]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      params.append("paymentsPage", String(paymentsPage));
      params.append("paymentsPageSize", String(paymentsPageSize));
      params.append("pendingType", pendingFilter);
      params.append("pendingPage", String(pendingPage));
      params.append("pendingPageSize", String(pendingPageSize));
      const res = await fetch(`/api/clinic/reports/revenue?${params.toString()}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTotalRevenue(0);
        setTreatmentRevenue(0);
        setPackageRevenue(0);
        setAdvanceRevenue(0);
        setPendingCleared(0);
        setRevenueByDoctor([]);
        setRevenueByStaff([]);
        setRevenueByService([]);
        setRevenueByPackage([]);
        setRevenueByDepartment([]);
        setRevenueByPaymentMethod([]);
        setDaily([]); setWeekly([]); setMonthly([]); setYearly([]);
        return;
      }
      setTotalRevenue(json.data?.totalRevenue || 0);
      setTreatmentRevenue(json.data?.treatmentRevenue || 0);
      setPackageRevenue(json.data?.packageRevenue || 0);
      setAdvanceRevenue(json.data?.advanceRevenue || 0);
      setPendingCleared(json.data?.pendingCleared || 0);
      setRevenueByDoctor(json.data?.revenueByDoctor || []);
      setRevenueByStaff(json.data?.revenueByStaff || []);
      setRevenueByService(json.data?.revenueByService || []);
      console.log('DEBUG Frontend revenueByService:', json.data?.revenueByService);
      setRevenueByPackage(json.data?.revenueByPackage || []);
      setRevenueByDepartment(json.data?.revenueByDepartment || []);
      setRevenueByPaymentMethod(json.data?.revenueByPaymentMethod || []);
      setDaily(json.data?.views?.daily || []);
      setWeekly(json.data?.views?.weekly || []);
      setMonthly(json.data?.views?.monthly || []);
      setYearly(json.data?.views?.yearly || []);
      setPayments(json.data?.payments || []);
      setPaymentsTotal(json.data?.paymentsTotal || 0);
      setPendingPayments(json.data?.pendingPayments || []);
      setPendingTotal(json.data?.pendingTotal || 0);
      setTopPendingPatients(json.data?.topPendingPatients || []);
      setTopAdvancePatients(json.data?.topAdvancePatients || []);
    } finally {
      setLoading(false);
    }
  }

  const chartDaily = useMemo(() => daily.map((d) => ({ name: d.label, amount: d.amount })), [daily]);
  const chartWeekly = useMemo(() => weekly.map((d) => ({ name: d.label, amount: d.amount })), [weekly]);
  const chartMonthly = useMemo(() => monthly.map((d) => ({ name: d.label, amount: d.amount })), [monthly]);
  const chartYearly = useMemo(() => yearly.map((d) => ({ name: d.label, amount: d.amount })), [yearly]);
  const chartData = useMemo(() => {
    if (viewMode === "daily") return chartDaily;
    if (viewMode === "weekly") return chartWeekly;
    if (viewMode === "monthly") return chartMonthly;
    return chartYearly;
  }, [viewMode, chartDaily, chartWeekly, chartMonthly, chartYearly]);
  const chartColor = useMemo(() => {
    if (viewMode === "daily") return "#2D9AA5";
    if (viewMode === "weekly") return "#0EA5E9";
    if (viewMode === "monthly") return "#F59E0B";
    return "#22C55E";
  }, [viewMode]);

  type PaymentItem = {
    invoiceNumber: string;
    patientName: string;
    service: string;
    doctorName: string;
    amount: number;
    paidAmount: number;
    paymentMethod: string;
    transactionType: string;
    paymentStatus: string;
    paymentDate: string | null;
  };
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  type PendingItem = {
    invoiceNumber: string;
    patientName: string;
    serviceName: string;
    doctorName: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    advanceAmount: number;
    dueDate: string | null;
  };
  const [pendingPayments, setPendingPayments] = useState<PendingItem[]>([]);

  const revenueExportSections = useMemo(() => {
    const currencyLabel = currency;
    return [
    {
      title: "Revenue Summary",
      headers: ["Metric", `Amount (${currencyLabel})`],
      data: [
        { "Metric": "Total Revenue", [`Amount (${currencyLabel})`]: Math.round(totalRevenue || 0) },
        { "Metric": "Treatment / Service Revenue", [`Amount (${currencyLabel})`]: Math.round(treatmentRevenue || 0) },
        { "Metric": "Package Billing Revenue", [`Amount (${currencyLabel})`]: Math.round(packageRevenue || 0) },
        { "Metric": "Advance Payment Revenue", [`Amount (${currencyLabel})`]: Math.round(advanceRevenue || 0) },
        { "Metric": "Pending Cleared", [`Amount (${currencyLabel})`]: Math.round(pendingCleared || 0) },
      ],
    },
    {
      title: "Revenue by Doctor",
      headers: ["Doctor", `Revenue (${currencyLabel})`],
      data: revenueByDoctor.map(r => ({
        "Doctor": r.name || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
      })),
    },
    {
      title: "Revenue by Staff (Direct Billings)",
      headers: ["Staff/Agent", `Revenue (${currencyLabel})`, "Invoices"],
      data: revenueByStaff.map(r => ({
        "Staff/Agent": r.name || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
        "Invoices": r.invoices || 0,
      })),
    },
    {
      title: "Revenue by Service",
      headers: ["Service", `Revenue (${currencyLabel})`],
      data: revenueByService.map(r => ({
        "Service": r.name || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
      })),
    },
    {
      title: "Revenue by Package",
      headers: ["Package", `Revenue (${currencyLabel})`],
      data: revenueByPackage.map(r => ({
        "Package": r.packageName || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
      })),
    },
    {
      title: "Revenue by Department",
      headers: ["Department", `Revenue (${currencyLabel})`],
      data: revenueByDepartment.map(r => ({
        "Department": r.name || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
      })),
    },
    {
      title: "Revenue by Payment Method",
      headers: ["Payment Method", `Revenue (${currencyLabel})`],
      data: revenueByPaymentMethod.map(r => ({
        "Payment Method": r.method || "Unknown",
        [`Revenue (${currencyLabel})`]: Math.round(r.amount || 0),
      })),
    },
    {
      title: "Top Pending Patients",
      headers: ["Patient Name", `Pending Amount (${currencyLabel})`],
      data: topPendingPatients.map(p => ({
        "Patient Name": p.name || "Unknown",
        [`Pending Amount (${currencyLabel})`]: Math.round(p.amount || 0),
      })),
    },
    {
      title: "Top Advance Patients",
      headers: ["Patient Name", `Advance Amount (${currencyLabel})`],
      data: topAdvancePatients.map(p => ({
        "Patient Name": p.name || "Unknown",
        [`Advance Amount (${currencyLabel})`]: Math.round(p.amount || 0),
      })),
    },
    {
      title: "Pending / Advance Payment Report",
      headers: ["Patient Name", "Invoice Number", "Service", "Doctor", `Total Amount (${currencyLabel})`, `Paid Amount (${currencyLabel})`, `Pending Amount (${currencyLabel})`, `Advance Amount (${currencyLabel})`, "Due Date"],
      data: pendingPayments.map(pp => ({
        "Patient Name": pp.patientName || "Unknown",
        "Invoice Number": pp.invoiceNumber || "-",
        "Service": pp.serviceName || "Unknown",
        "Doctor": pp.doctorName || "—",
        [`Total Amount (${currencyLabel})`]: Math.round(pp.totalAmount || 0),
        [`Paid Amount (${currencyLabel})`]: Math.round(pp.paidAmount || 0),
        [`Pending Amount (${currencyLabel})`]: Math.round(pp.pendingAmount || 0),
        [`Advance Amount (${currencyLabel})`]: Math.round(pp.advanceAmount || 0),
        "Due Date": pp.dueDate ? new Date(pp.dueDate).toLocaleDateString() : "-",
      })),
    },
    {
      title: "Payment Reports",
      headers: ["Invoice Number", "Patient Name", "Service", "Doctor", `Total Amount (${currencyLabel})`, `Paid Amount (${currencyLabel})`, "Payment Method", "Transaction Type", "Payment Status", "Payment Date"],
      data: payments.map(p => ({
        "Invoice Number": p.invoiceNumber || "-",
        "Patient Name": p.patientName || "Unknown",
        "Service": p.service || "Unknown",
        "Doctor": p.doctorName || "—",
        [`Total Amount (${currencyLabel})`]: Math.round(p.amount || 0),
        [`Paid Amount (${currencyLabel})`]: Math.round(p.paidAmount || 0),
        "Payment Method": p.paymentMethod || "-",
        "Transaction Type": p.transactionType || "Payment",
        "Payment Status": p.paymentStatus || "-",
        "Payment Date": p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-",
      })),
    },
  ]}, [totalRevenue, treatmentRevenue, packageRevenue, advanceRevenue, pendingCleared, revenueByDoctor, revenueByService, revenueByPackage, revenueByDepartment, revenueByPaymentMethod, topPendingPatients, topAdvancePatients, pendingPayments, payments, currency]);

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <ExportButtons
          sections={revenueExportSections}
          filename={`revenue_report_${startDate}_to_${endDate}`}
          title="Revenue Detailed Report"
        />
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Revenue Summary</h3>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Revenue</div>
            <div className="text-2xl font-bold text-[#2D9AA5]">{fmtCurrency(totalRevenue)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Treatment / Service</div>
            <div className="text-2xl font-bold text-blue-600">{fmtCurrency(treatmentRevenue)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Package Billing</div>
            <div className="text-2xl font-bold text-purple-600">{fmtCurrency(packageRevenue)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Advance Payments</div>
            <div className="text-2xl font-bold text-emerald-600">{fmtCurrency(advanceRevenue)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Pending Cleared</div>
            <div className="text-2xl font-bold text-amber-600">{fmtCurrency(pendingCleared)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 5 Patients by Pending/Advance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="w-full" style={{ height: 280 }}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Top Pending</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topPendingPatients.map((p) => ({ name: p.name, amount: p.amount }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full" style={{ height: 280 }}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Top Advance</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topAdvancePatients.map((p) => ({ name: p.name, amount: p.amount }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Doctor</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByDoctor.map((r) => (
                <tr key={r.doctorId}>
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedDoctor(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByDoctor.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No data</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-600">
              Showing{" "}
              {pendingPayments.length ? (pendingPage - 1) * pendingPageSize + 1 : 0}
              {"–"}
              {pendingPayments.length ? (pendingPage - 1) * pendingPageSize + pendingPayments.length : 0}
              {" of "}
              {pendingTotal}
            </div>
            <div className="inline-flex gap-2">
              <button
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                disabled={pendingPage <= 1}
                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                disabled={pendingPage >= Math.max(1, Math.ceil(pendingTotal / pendingPageSize))}
                onClick={() =>
                  setPendingPage((p) => Math.min(Math.max(1, Math.ceil(pendingTotal / pendingPageSize)), p + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Staff (Direct Billings)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Staff/Agent</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Invoices</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByStaff.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">{r.invoices}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedStaff(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByStaff.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={4}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Service</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Service</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByService.map((r) => (
                <tr key={r.serviceId}>
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedService(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByService.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Package</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Package</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByPackage.map((r) => (
                <tr key={r.packageName}>
                  <td className="px-4 py-2 text-sm">{r.packageName}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedPackage(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByPackage.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Department</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Department</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByDepartment.map((r) => (
                <tr key={r.departmentId}>
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedDepartment(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByDepartment.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Revenue by Payment Method</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Method</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {revenueByPaymentMethod.map((r) => (
                <tr key={r.method}>
                  <td className="px-4 py-2 text-sm">{r.method}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => setSelectedPaymentMethod(r)}
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!revenueByPaymentMethod.length && (
                <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Revenue Trend</h3>
          <div className="inline-flex rounded-lg bg-gray-100">
            <button
              className={`px-3 py-1 rounded-l ${viewMode === "daily" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setViewMode("daily")}
            >
              Daily
            </button>
            <button
              className={`px-3 py-1 ${viewMode === "weekly" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setViewMode("weekly")}
            >
              Weekly
            </button>
            <button
              className={`px-3 py-1 ${viewMode === "monthly" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setViewMode("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-1 rounded-r ${viewMode === "yearly" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setViewMode("yearly")}
            >
              Yearly
            </button>
          </div>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill={chartColor} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {pendingFilter === "advance" ? "Advance Payment Report" : "Pending Payment Report"}
          </h3>
          <div className="inline-flex rounded-lg bg-gray-100">
            <button
              className={`px-3 py-1 rounded-l ${pendingFilter === "pending" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setPendingFilter("pending")}
            >
              Pending
            </button>
            <button
              className={`px-3 py-1 rounded-r ${pendingFilter === "advance" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
              onClick={() => setPendingFilter("advance")}
            >
              Advance
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Patient Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Invoice Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Service/Membership/Package</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Paid Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Pending Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Advance Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Due Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {pendingPayments.map((pp) => (
                <tr key={`${pp.invoiceNumber}-${pp.pendingAmount}`}>
                  <td className="px-4 py-2 text-sm">{pp.patientName || "Unknown"}</td>
                  <td className="px-4 py-2 text-sm">{pp.invoiceNumber}</td>
                  <td className="px-4 py-2 text-sm">{pp.serviceName || "Unknown"}</td>
                  <td className="px-4 py-2 text-sm">{pp.doctorName || "—"}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(pp.totalAmount)}</td>
                  <td className="px-4 py-2 text-sm">{fmtCurrency(pp.paidAmount)}</td>
                  <td className="px-4 py-2 text-sm text-red-600 font-semibold">{fmtCurrency(pp.pendingAmount)}</td>
                  <td className="px-4 py-2 text-sm text-green-700 font-semibold">{fmtCurrency(pp.advanceAmount)}</td>
                  <td className="px-4 py-2 text-sm">
                    {pp.dueDate ? new Date(pp.dueDate).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
              {!pendingPayments.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500" colSpan={9}>
                    No pending payments for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Payment Reports</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Invoice Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Patient Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Service</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Paid Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment Method</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Transaction Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {payments.map((p, idx) => (
                <tr key={`${p.invoiceNumber}-${p.paymentMethod}-${p.transactionType}-${idx}`}>
                  <td className="px-4 py-2 text-sm">{p.invoiceNumber}</td>
                  <td className="px-4 py-2 text-sm">{p.patientName || "Unknown"}</td>
                  <td className="px-4 py-2 text-sm">{p.service || "Unknown"}</td>
                  <td className="px-4 py-2 text-sm">{p.doctorName || "—"}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(p.amount)}</td>
                  <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(p.paidAmount)}</td>
                  <td className="px-4 py-2 text-sm">{p.paymentMethod}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${
                      p.transactionType === 'Pending Cleared' ? 'bg-amber-100 text-amber-700' :
                      p.transactionType === 'Advance Used' ? 'bg-blue-100 text-blue-700' :
                      p.transactionType === 'Insurance Claim' ? 'bg-purple-100 text-purple-700' :
                      p.transactionType === 'Cashback Used' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {p.transactionType || 'Payment'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{p.paymentStatus}</td>
                  <td className="px-4 py-2 text-sm">
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500" colSpan={10}>
                    No payments found for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-600">
              Showing{" "}
              {payments.length ? (paymentsPage - 1) * paymentsPageSize + 1 : 0}
              {"–"}
              {payments.length ? (paymentsPage - 1) * paymentsPageSize + payments.length : 0}
              {" of "}
              {paymentsTotal}
            </div>
            <div className="inline-flex gap-2">
              <button
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                disabled={paymentsPage <= 1}
                onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                disabled={paymentsPage >= Math.max(1, Math.ceil(paymentsTotal / paymentsPageSize))}
                onClick={() =>
                  setPaymentsPage((p) => Math.min(Math.max(1, Math.ceil(paymentsTotal / paymentsPageSize)), p + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for doctor details */}
      {selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Revenue Details - {selectedDoctor.name}
              </h2>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Advance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedDoctor.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => {
                    return (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() =>
                              router.push(
                                `/clinic/patient-profile-view?id=${detail.patientId}`
                              )
                            }
                            className="text-blue-600 hover:text-blue-800 font-medium underline"
                          >
                            {detail.patientName?.trim() || "Unknown"}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.emrNumber || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.service === "Package" ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                Package
                              </span>
                              <span>{detail.packageName || "Package"}</span>
                            </div>
                          ) : detail.service === "Treatment" ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                Treatment
                              </span>
                              <span>{detail.treatmentName || "Treatment"}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                {detail.service || "Service"}
                              </span>
                              <span>{detail.treatmentName || detail.service || "Service"}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.invoiceNumber || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.invoicedDate
                            ? new Date(detail.invoicedDate).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {fmtCurrency(detail.amount)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {fmtCurrency(detail.paid)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {fmtCurrency(detail.pending)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {fmtCurrency(detail.advance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td
                      className="px-4 py-2 text-sm font-semibold"
                      colSpan={5}
                    >
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedDoctor.details.reduce(
                          (sum, d) => sum + Number(d.amount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(selectedDoctor.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedDoctor.details.reduce(
                          (sum, d) => sum + Number(d.pending || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedDoctor.details.reduce(
                          (sum, d) => sum + Number(d.advance || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal for staff details */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Staff Revenue Details - {selectedStaff.name}
              </h2>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Advance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedStaff.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => {
                    return (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() =>
                              router.push(
                                `/clinic/patient-profile-view?id=${detail.patientId}`
                              )
                            }
                            className="text-blue-600 hover:text-blue-800 font-medium underline"
                          >
                            {detail.patientName?.trim() || "Unknown"}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.emrNumber || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {detail.service === "Package" ? (
                            <div className="flex flex-col gap-1">
                              {/* Show package portion */}
                              {detail.packageAmount !== undefined && detail.packageAmount > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                    Package
                                  </span>
                                  <span>{detail.packageName || "Package"}</span>
                                  <span className="text-xs text-gray-500">({fmtCurrency(detail.packageAmount)})</span>
                                </div>
                              )}
                              {/* Show treatment breakdown if available */}
                              {detail.selectedTreatments && detail.selectedTreatments.length > 0 && (
                                <>
                                  {detail.selectedTreatments.map((t: any, tIdx: number) => (
                                    <div key={tIdx} className="flex items-center gap-2 ml-4">
                                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                        Treatment
                                      </span>
                                      <span>{t.treatmentName}</span>
                                      <span className="text-xs text-gray-500">({fmtCurrency(t.total)})</span>
                                    </div>
                                  ))}
                                </>
                              )}
                              {/* Fallback for regular package billings */}
                              {!detail.packageAmount && (!detail.selectedTreatments || detail.selectedTreatments.length === 0) && (
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                    Package
                                  </span>
                                  <span>{detail.packageName || "Package"}</span>
                                </div>
                              )}
                            </div>
                          ) : detail.service === "Treatment" ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                Treatment
                              </span>
                              <span>{detail.treatmentName || detail.service}</span>
                            </div>
                          ) : (
                            detail.service || "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">{detail.invoiceNumber || "-"}</td>
                        <td className="px-4 py-2 text-sm">
                          {detail.invoicedDate
                            ? new Date(detail.invoicedDate).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm">{fmtCurrency(detail.amount)}</td>
                        <td className="px-4 py-2 text-sm">{fmtCurrency(detail.paid)}</td>
                        <td className="px-4 py-2 text-sm">{fmtCurrency(detail.pending)}</td>
                        <td className="px-4 py-2 text-sm">{fmtCurrency(detail.advance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td
                      className="px-4 py-2 text-sm font-semibold"
                      colSpan={5}
                    >
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedStaff.details.reduce(
                          (sum, d) => sum + Number(d.amount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(selectedStaff.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedStaff.details.reduce(
                          (sum, d) => sum + Number(d.pending || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedStaff.details.reduce(
                          (sum, d) => sum + Number(d.advance || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal for service details */}
      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Revenue Details - {selectedService.name}
              </h2>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Advance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedService.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => {
                    const revenue = Number(detail.paid || 0) + Number(detail.advanceUsed || 0) + Number(detail.claimAmountUsed || 0) + Number(detail.cashbackWalletUsed || 0);
                    return (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">
                        <button
                          onClick={() =>
                            router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {detail.patientName?.trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {detail.service === "Package" ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                              Package
                            </span>
                            <span>{detail.packageName || "Package"}</span>
                          </div>
                        ) : detail.service === "Treatment" ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              Treatment
                            </span>
                            <span>{detail.treatmentName || "Treatment"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                              {detail.service || "Service"}
                            </span>
                            <span>{detail.treatmentName || detail.service || "Service"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {detail.invoicedDate
                          ? new Date(detail.invoicedDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.amount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-[#2D9AA5]">{fmtCurrency(revenue)}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.pending)}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.advance)}</td>
                    </tr>
                  );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedService.details.reduce(
                          (sum, d) => sum + Number(d.amount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-[#2D9AA5]">
                      {fmtCurrency(selectedService.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedService.details.reduce(
                          (sum, d) => sum + Number(d.pending || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedService.details.reduce(
                          (sum, d) => sum + Number(d.advance || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal for package details */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Revenue Details - {selectedPackage.packageName}
              </h2>
              <button
                onClick={() => setSelectedPackage(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Sold By
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Advance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedPackage.details].sort((a, b) => new Date(b.invoicedDate).getTime() - new Date(a.invoicedDate).getTime()).map((detail, index) => {
                    const revenue = Number(detail.paid || 0) + Number(detail.advanceUsed || 0) + Number(detail.claimAmountUsed || 0) + Number(detail.cashbackWalletUsed || 0);
                    return (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">
                        <button
                          onClick={() =>
                            router.push(`/clinic/patient-profile-view?id=${detail.patientId}`)
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          {detail.patientName?.trim() || "Unknown"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm">{detail.emrNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {detail.service === "Package" ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                              Package
                            </span>
                            <span>{detail.packageName || "Package"}</span>
                          </div>
                        ) : detail.service === "Treatment" ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              Treatment
                            </span>
                            <span>{detail.treatmentName || "Treatment"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                              {detail.service || "Service"}
                            </span>
                            <span>{detail.treatmentName || detail.service || "Service"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">{detail.invoiceNumber || "-"}</td>
                      <td className="px-4 py-2 text-sm">
                        {detail.invoicedDate
                          ? new Date(detail.invoicedDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm">{detail.packageSoldBy || "-"}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.amount)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-[#2D9AA5]">{fmtCurrency(revenue)}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.paid)}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.pending)}</td>
                      <td className="px-4 py-2 text-sm font-medium">{fmtCurrency(detail.advance)}</td>
                    </tr>
                  );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedPackage.details.reduce(
                          (sum, d) => sum + Number(d.amount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-[#2D9AA5]">
                      {fmtCurrency(selectedPackage.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedPackage.details.reduce(
                          (sum, d) => sum + Number(d.paid || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedPackage.details.reduce(
                          (sum, d) => sum + Number(d.pending || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedPackage.details.reduce(
                          (sum, d) => sum + Number(d.advance || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal for department details */}
      {selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Revenue Details - {selectedDepartment.name}
              </h2>
              <button
                onClick={() => setSelectedDepartment(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedDepartment.details]
                    .sort(
                      (a, b) =>
                        new Date(b.invoicedDate).getTime() -
                        new Date(a.invoicedDate).getTime()
                    )
                    .map((detail, index) => {
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm">
                            <button
                              onClick={() =>
                                router.push(
                                  `/clinic/patient-profile-view?id=${detail.patientId}`
                                )
                              }
                              className="text-blue-600 hover:text-blue-800 font-medium underline"
                            >
                              {detail.patientName?.trim() || "Unknown"}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.emrNumber || "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.service === "Package" ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                  Package
                                </span>
                                <span>{detail.packageName || "Package"}</span>
                              </div>
                            ) : detail.service === "Treatment" ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                  Treatment
                                </span>
                                <span>{detail.treatmentName || "Treatment"}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                  {detail.service || "Service"}
                                </span>
                                <span>
                                  {detail.treatmentName || detail.service || "Service"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.invoiceNumber || "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.invoicedDate
                              ? new Date(detail.invoicedDate).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {fmtCurrency(detail.totalAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-[#2D9AA5]">
                            {fmtCurrency(detail.revenue)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedDepartment.details.reduce(
                          (sum, d) => sum + Number(d.totalAmount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-[#2D9AA5]">
                      {fmtCurrency(selectedDepartment.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal for payment method details */}
      {selectedPaymentMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Revenue Details - {selectedPaymentMethod.method}
              </h2>
              <button
                onClick={() => setSelectedPaymentMethod(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      EMR No
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Service/Package
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...selectedPaymentMethod.details]
                    .sort(
                      (a, b) =>
                        new Date(b.invoicedDate).getTime() -
                        new Date(a.invoicedDate).getTime()
                    )
                    .map((detail, index) => {
                      const serviceLabel = detail.package ? "Package" : detail.service === "Treatment" ? "Treatment" : "Service";
                      const serviceName = detail.package || detail.treatment || detail.service || "Service";
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm">
                            <button
                              onClick={() =>
                                router.push(
                                  `/clinic/patient-profile-view?id=${detail.patientId}`
                                )
                              }
                              className="text-blue-600 hover:text-blue-800 font-medium underline"
                            >
                              {detail.patientName?.trim() || "Unknown"}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.emrNumber || "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                serviceLabel === "Package" ? "bg-blue-100 text-blue-800" :
                                serviceLabel === "Treatment" ? "bg-green-100 text-green-800" :
                                "bg-purple-100 text-purple-800"
                              }`}>
                                {serviceLabel}
                              </span>
                              <span>{serviceName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.invoiceNumber || "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {detail.invoicedDate
                              ? new Date(detail.invoicedDate).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {fmtCurrency(detail.totalAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-[#2D9AA5]">
                            {fmtCurrency(detail.revenue)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot className="bg-gray-50 sticky bottom-0">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold" colSpan={5}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold">
                      {fmtCurrency(
                        selectedPaymentMethod.details.reduce(
                          (sum, d) => sum + Number(d.totalAmount || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-[#2D9AA5]">
                      {fmtCurrency(selectedPaymentMethod.amount)}
                    </td>
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
