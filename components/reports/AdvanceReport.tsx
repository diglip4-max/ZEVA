import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Search,
  Wallet,
  X,
} from "lucide-react";
import ExportButtons from "./ExportButtons";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

type HeadersRecord = Record<string, string>;

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

// A single advance payment record (Billing with treatment === "Advance Payment")
type AdvancePayment = {
  _id: string;
  invoiceNumber: string;
  advanceAmount: number;
  paid: number;
  paymentMethod: string;
  multiplePayments: Array<{ paymentMethod: string; amount: number }>;
  transactionId: string;
  attachment: string;
  notes: string;
  status: string;
  date: string | null;
};

// One row per patient with every advance payment attached
type PatientRow = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  mobileNumber: string;
  totalAdvance: number;
  // All-time remaining (available) advance for the patient, computed
  // server-side in /api/clinic/reports/advance using the exact same
  // logic as /api/clinic/patient-balance/[patientId] → advanceBalance.
  remainingAdvance: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  payments: AdvancePayment[];
};

// A single pending clearance record (Billing whose pendingClearedBreakdown
// contains at least one entry with amountCleared > 0)
type PendingClearance = {
  _id: string;
  invoiceNumber: string;
  treatment: string;
  service: string;
  clearanceAmount: number;
  entryCount: number;
  paymentMethod: string;
  multiplePayments: Array<{
    paymentMethod: string;
    amount: number;
    transactionType?: string;
  }>;
  transactionId: string;
  attachment: string;
  notes: string;
  status: string;
  date: string | null;
};

// One row per patient with every clearance attached
type PendingPatientRow = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  mobileNumber: string;
  totalCleared: number;
  clearanceCount: number;
  lastClearanceDate: string | null;
  clearances: PendingClearance[];
};

// A single outstanding pending item for one patient — a PatientPendingLedger
// row (Open/Partial, remaining > 0) or, for legacy billings created before
// the ledger release, a row synthesised from the billing itself (mirrors
// lib/pendingLedger.js syncBillingFromLegacy backfill).
type PendingItem = {
  ledgerId: string;
  invoiceNumber: string;
  service: string;
  treatmentName: string | null;
  packageName: string | null;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  date: string | null;
};

// One row per patient with the outstanding pending amount (the same value
// the patient-profile overview "Pending Payment" card shows) and the full
// per-treatment breakdown rendered by its "Pending Breakdown" panel.
type PendingBalancePatient = {
  patientId: string;
  patientName: string;
  emrNumber: string;
  mobileNumber: string;
  totalPending: number;
  invoiceCount: number;
  itemCount: number;
  lastPendingDate: string | null;
  pendingBreakdown: PendingItem[];
};

const isImageAttachment = (url: string): boolean =>
  /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url) ||
  url.includes("/image/upload/");

// Legacy clearance records store a system-generated allocation summary in
// the billing notes field — e.g. "Package billing - Unpaid payment. Total:
// 500, Cash/Card: 0, Advance used: 0, Claim used: 0" or the allocation
// fallback "Pending payment allocation across 2 ledger row(s)". This is
// internal bookkeeping metadata, not a user note, so the Pending Clearance
// modal hides it while still showing genuine notes.
const isSystemClearanceNote = (notes: string | null | undefined): boolean => {
  if (!notes) return false;
  if (/Cash\/Card:.*Advance used:.*Claim used:/i.test(notes)) return true;
  if (/^Pending payment allocation across/i.test(notes)) return true;
  return false;
};

// Segmented section filter shown under the summary cards.
const SECTION_FILTERS = [
  { key: "all", label: "All" },
  { key: "advance", label: "Advance" },
  { key: "clearance", label: "Clearance" },
  { key: "pending", label: "Pending" },
] as const;

type SectionFilterKey = (typeof SECTION_FILTERS)[number]["key"];

const formatDateTime = (d: string | null): string =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// ============================================================================
// View-modal building blocks — the "Advance details" table design: one row
// per payment with avatar, amount + method chip + date pill, copyable
// transaction ID and an attachment preview link. Shared by the Advance
// Balance and Pending Clearance modals so multiple payments / clearances of
// the same patient stack as fully aligned table rows.
// ============================================================================

const PAYMENT_TABLE_GRID =
  "grid grid-cols-[1.2fr_0.9fr_1.6fr_1.5fr_1.2fr] gap-4 items-start";

function PatientAvatar({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-bold flex items-center justify-center">
      {initial}
    </div>
  );
}

function CopyLink({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function AttachmentCell({ url }: { url: string }) {
  if (!url) {
    return <span className="text-xs text-gray-400">No attachment</span>;
  }
  const isImage = isImageAttachment(url);
  return (
    <div className="flex items-center gap-2.5">
      <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
        {isImage ? (
          <img
            src={url}
            alt="Payment attachment"
            className="h-10 w-10 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition"
          />
        ) : (
          <div className="h-10 w-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
      >
        {isImage ? "View image" : "View file"}
      </a>
    </div>
  );
}

export default function AdvanceReport({ startDate, endDate, headers }: Props) {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [totals, setTotals] = useState<{
    totalAdvance: number;
    totalRemaining: number;
    totalPatients: number;
    totalPayments: number;
  } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10; // pagination: only 10 patient rows per page
  const [pendingPatients, setPendingPatients] = useState<PendingPatientRow[]>([]);
  const [pendingTotals, setPendingTotals] = useState<{
    totalCleared: number;
    totalPatients: number;
    totalClearances: number;
  } | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [selectedPendingPatient, setSelectedPendingPatient] =
    useState<PendingPatientRow | null>(null);
  const [balancePatients, setBalancePatients] = useState<
    PendingBalancePatient[]
  >([]);
  const [balanceTotals, setBalanceTotals] = useState<{
    totalPending: number;
    totalPatients: number;
    totalItems: number;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balancePage, setBalancePage] = useState(1);
  const [selectedBalancePatient, setSelectedBalancePatient] =
    useState<PendingBalancePatient | null>(null);
  // Transaction ID value copied to clipboard (shows "Copied!" briefly)
  const [copiedTxn, setCopiedTxn] = useState<string | null>(null);
  // Per-section search filters (patient name / EMR / mobile).
  const [advanceSearch, setAdvanceSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [balanceSearch, setBalanceSearch] = useState("");
  // Segmented filter — show all sections or one section at a time.
  const [sectionFilter, setSectionFilter] = useState<SectionFilterKey>("all");

  const fmtCurrency = (n: number | null | undefined) => {
    const symbol = getCurrencySymbol(currency);
    const value = n ?? 0;
    return `${symbol}${value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  // Client-side search — a query matches a patient when any of the given
  // fields (name, EMR, mobile) contains it, case-insensitively.
  const matchesSearch = (
    q: string,
    ...fields: Array<string | null | undefined>
  ): boolean => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return fields.some((f) => (f || "").toLowerCase().includes(needle));
  };

  // Payment methods for a clearance record: prefer the PENDING_CLEARANCE
  // rows of multiplePayments (what was actually paid to clear the pending),
  // then any payment rows, then fall back to the billing-level method.
  const clearanceMethodChips = (
    c: PendingClearance,
  ): Array<{ paymentMethod: string; amount: number }> => {
    const all = (c.multiplePayments || []).filter((m) => m && m.paymentMethod);
    const clearanceOnly = all.filter(
      (m) => m.transactionType === "PENDING_CLEARANCE",
    );
    const list = clearanceOnly.length > 0 ? clearanceOnly : all;
    if (list.length > 0) return list;
    if (c.paymentMethod) {
      return [{ paymentMethod: c.paymentMethod, amount: c.clearanceAmount }];
    }
    return [];
  };

  // Breakdown row label — the same rule the profile view uses: package rows
  // show their package name, everything else shows the treatment name.
  const pendingItemLabel = (item: PendingItem): string =>
    item.service === "Package"
      ? item.packageName || "Package"
      : item.treatmentName || item.service || "Service";

  // Copy a transaction id from either View modal, with brief feedback.
  const copyTxn = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTxn(value);
      setTimeout(() => setCopiedTxn((c) => (c === value ? null : c)), 1500);
    } catch {
      /* clipboard API unavailable */
    }
  };

  useEffect(() => {
    fetchData();
    fetchPendingData();
    fetchBalanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(
        `/api/clinic/reports/advance?${params.toString()}`,
        { headers },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPatients([]);
        setTotals(null);
        setError(json.message || "Failed to load advance report");
        return;
      }
      setPatients(json.data?.patients || []);
      setTotals(json.data?.totals || null);
      setPage(1); // new date range → back to the first page
    } catch (e: any) {
      setPatients([]);
      setTotals(null);
      setError(e?.message || "Failed to load advance report");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingData() {
    setPendingLoading(true);
    setPendingError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(
        `/api/clinic/reports/pending-clearance?${params.toString()}`,
        { headers },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPendingPatients([]);
        setPendingTotals(null);
        setPendingError(
          json.message || "Failed to load pending clearance report",
        );
        return;
      }
      setPendingPatients(json.data?.patients || []);
      setPendingTotals(json.data?.totals || null);
      setPendingPage(1); // new date range → back to the first page
    } catch (e: any) {
      setPendingPatients([]);
      setPendingTotals(null);
      setPendingError(
        e?.message || "Failed to load pending clearance report",
      );
    } finally {
      setPendingLoading(false);
    }
  }

  async function fetchBalanceData() {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(
        `/api/clinic/reports/pending-balance?${params.toString()}`,
        { headers },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setBalancePatients([]);
        setBalanceTotals(null);
        setBalanceError(
          json.message || "Failed to load pending balance report",
        );
        return;
      }
      setBalancePatients(json.data?.patients || []);
      setBalanceTotals(json.data?.totals || null);
      setBalancePage(1); // new date range → back to the first page
    } catch (e: any) {
      setBalancePatients([]);
      setBalanceTotals(null);
      setBalanceError(e?.message || "Failed to load pending balance report");
    } finally {
      setBalanceLoading(false);
    }
  }

  // Export layout (PDF / CSV / Excel): one row per advance payment with the
  // exact columns requested — patient name, EMR, advance amount, transaction ID.
  const exportSections = useMemo(() => {
    const currencyLabel = currency;
    return [
      {
        title: "Advance Report",
        headers: [
          "Patient Name",
          "EMR No",
          `Advance Amount (${currencyLabel})`,
          "Transaction ID",
        ],
        data: patients.flatMap((p) =>
          (p.payments || []).map((pay) => ({
            "Patient Name": p.patientName || "Unknown",
            "EMR No": p.emrNumber || "-",
            [`Advance Amount (${currencyLabel})`]: Number(
              (pay.advanceAmount || 0).toFixed(2),
            ),
            "Transaction ID": pay.transactionId || "-",
          })),
        ),
      },
      {
        title: "Pending Clearance",
        headers: [
          "Patient Name",
          "EMR No",
          `Pending Clearance Amount (${currencyLabel})`,
          "Transaction ID",
        ],
        data: pendingPatients.flatMap((p) =>
          (p.clearances || []).map((c) => ({
            "Patient Name": p.patientName || "Unknown",
            "EMR No": p.emrNumber || "-",
            [`Pending Clearance Amount (${currencyLabel})`]: Number(
              (c.clearanceAmount || 0).toFixed(2),
            ),
            "Transaction ID": c.transactionId || "-",
          })),
        ),
      },
      {
        title: "Pending Balance",
        headers: [
          "Patient Name",
          "EMR No",
          `Pending Amount (${currencyLabel})`,
        ],
        data: balancePatients.map((p) => ({
          "Patient Name": p.patientName || "Unknown",
          "EMR No": p.emrNumber || "-",
          [`Pending Amount (${currencyLabel})`]: Number(
            (p.totalPending || 0).toFixed(2),
          ),
        })),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, pendingPatients, balancePatients, currency]);

  // Client-side search filtering — each table filters its own patient list by
  // name, EMR or mobile; an empty query shows every patient.
  const filteredPatients = patients.filter((p) =>
    matchesSearch(advanceSearch, p.patientName, p.emrNumber, p.mobileNumber),
  );
  const filteredPendingPatients = pendingPatients.filter((p) =>
    matchesSearch(pendingSearch, p.patientName, p.emrNumber, p.mobileNumber),
  );
  const filteredBalancePatients = balancePatients.filter((p) =>
    matchesSearch(balanceSearch, p.patientName, p.emrNumber, p.mobileNumber),
  );

  // Client-side pagination — only the first 10 patients render per page;
  // the pagination bar appears automatically when there are more than 10.
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPatients.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pagedPatients = filteredPatients.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Pagination for the Pending Clearance table (same 10-rows-per-page rule).
  const pendingTotalPages = Math.max(
    1,
    Math.ceil(filteredPendingPatients.length / PAGE_SIZE),
  );
  const pendingSafePage = Math.min(pendingPage, pendingTotalPages);
  const pagedPendingPatients = filteredPendingPatients.slice(
    (pendingSafePage - 1) * PAGE_SIZE,
    pendingSafePage * PAGE_SIZE,
  );

  // Pagination for the Pending Balance table (same 10-rows-per-page rule).
  const balanceTotalPages = Math.max(
    1,
    Math.ceil(filteredBalancePatients.length / PAGE_SIZE),
  );
  const balanceSafePage = Math.min(balancePage, balanceTotalPages);
  const pagedBalancePatients = filteredBalancePatients.slice(
    (balanceSafePage - 1) * PAGE_SIZE,
    balanceSafePage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      {/* Page header — title, subtitle and export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Patient balances
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Advance, clearance and pending amounts in one view
            {(loading || pendingLoading || balanceLoading) && (
              <span className="ml-2 text-xs text-gray-400">Loading…</span>
            )}
          </p>
        </div>
        <ExportButtons
          sections={exportSections}
          filename={`advance_pending_report_${startDate}_to_${endDate}`}
          title="Advance & Pending Report"
        />
      </div>

      {/* Summary stat cards — one per section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Advance balance */}
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-semibold text-teal-900">
              Advance balance
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-teal-700">
            {fmtCurrency(totals?.totalAdvance)}
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-600">
            Remaining: {fmtCurrency(totals?.totalRemaining)}
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-lg bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
              Patients: {totals?.totalPatients ?? 0} · Payments:{" "}
              {totals?.totalPayments ?? 0}
            </span>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-teal-500" />
        </div>

        {/* Pending clearance */}
        <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-semibold text-orange-800">
              Pending clearance
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-orange-600">
            {fmtCurrency(pendingTotals?.totalCleared)}
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-lg bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-800">
              Patients: {pendingTotals?.totalPatients ?? 0} · Transactions:{" "}
              {pendingTotals?.totalClearances ?? 0}
            </span>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-orange-500" />
        </div>

        {/* Pending balance */}
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-semibold text-rose-800">
              Pending balance
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-rose-600">
            {fmtCurrency(balanceTotals?.totalPending)}
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-lg bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-800">
              Patients: {balanceTotals?.totalPatients ?? 0} · Items:{" "}
              {balanceTotals?.totalItems ?? 0}
            </span>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-rose-500" />
        </div>
      </div>

      {/* Section filter — segmented pill control below the summary cards */}
      <div className="flex">
        <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 p-1.5">
          {SECTION_FILTERS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSectionFilter(tab.key)}
              className={`px-5 py-2 rounded-xl text-sm border transition-colors ${
                sectionFilter === tab.key
                  ? "bg-white text-gray-900 font-semibold border-gray-200 shadow-sm"
                  : "text-slate-500 font-medium border-transparent hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advance Balance table */}
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${
          sectionFilter === "all" || sectionFilter === "advance" ? "" : "hidden"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-teal-500" />
            <h3 className="text-base font-bold text-teal-700">
              Advance balance
            </h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={advanceSearch}
              onChange={(e) => {
                setAdvanceSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search patient, EMR or mobile"
              className="w-full sm:w-72 pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500">
                  Patient
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Advance balance
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Remaining
                </th>
                <th className="w-28 px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedPatients.map((p) => (
                <tr
                  key={p.patientId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <PatientAvatar name={p.patientName} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">
                          {p.patientName || "Unknown"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                          {p.emrNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                              EMR: {p.emrNumber}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {p.paymentCount} payment
                            {p.paymentCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-base font-bold text-teal-600 whitespace-nowrap">
                    {fmtCurrency(p.totalAdvance)}
                  </td>
                  <td className="px-5 py-4 text-right text-base font-bold text-emerald-600 whitespace-nowrap">
                    {fmtCurrency(p.remainingAdvance)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedPatient(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredPatients.length && !loading && (
                <tr>
                  <td
                    className="px-5 py-8 text-sm text-gray-400 text-center"
                    colSpan={4}
                  >
                    {advanceSearch.trim()
                      ? "No patients match your search."
                      : "No advance payments found for the selected date range."}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredPatients.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Total ({patients.length} patient
                    {patients.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-teal-700">
                    {fmtCurrency(totals?.totalAdvance)}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                    {fmtCurrency(totals?.totalRemaining)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer — showing counter + pagination */}
        {filteredPatients.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredPatients.length)} of{" "}
              {filteredPatients.length} patient
              {filteredPatients.length === 1 ? "" : "s"}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {totalPages > 1 && (
                <span className="text-xs text-gray-500">
                  Page {safePage} of {totalPages}
                </span>
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Clearance table */}
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${
          sectionFilter === "all" || sectionFilter === "clearance"
            ? ""
            : "hidden"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            <h3 className="text-base font-bold text-orange-600">
              Pending clearance
            </h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={pendingSearch}
              onChange={(e) => {
                setPendingSearch(e.target.value);
                setPendingPage(1);
              }}
              placeholder="Search patient, EMR or mobile"
              className="w-full sm:w-72 pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
            />
          </div>
        </div>

        {pendingError && (
          <div className="mx-5 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            {pendingError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500">
                  Patient
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Pending clearance
                </th>
                <th className="w-28 px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedPendingPatients.map((p) => (
                <tr
                  key={p.patientId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <PatientAvatar name={p.patientName} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">
                          {p.patientName || "Unknown"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                          {p.emrNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                              EMR: {p.emrNumber}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {p.clearanceCount} clearance
                            {p.clearanceCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-base font-bold text-orange-600 whitespace-nowrap">
                    {fmtCurrency(p.totalCleared)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedPendingPatient(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredPendingPatients.length && !pendingLoading && (
                <tr>
                  <td
                    className="px-5 py-8 text-sm text-gray-400 text-center"
                    colSpan={3}
                  >
                    {pendingSearch.trim()
                      ? "No patients match your search."
                      : "No pending clearances found for the selected date range."}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredPendingPatients.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Total ({pendingPatients.length} patient
                    {pendingPatients.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-orange-700">
                    {fmtCurrency(pendingTotals?.totalCleared)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer — showing counter + pagination */}
        {filteredPendingPatients.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Showing {(pendingSafePage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                pendingSafePage * PAGE_SIZE,
                filteredPendingPatients.length,
              )}{" "}
              of {filteredPendingPatients.length} patient
              {filteredPendingPatients.length === 1 ? "" : "s"}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() =>
                  setPendingPage(Math.max(1, pendingSafePage - 1))
                }
                disabled={pendingSafePage <= 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pendingTotalPages > 1 && (
                <span className="text-xs text-gray-500">
                  Page {pendingSafePage} of {pendingTotalPages}
                </span>
              )}
              <button
                onClick={() =>
                  setPendingPage(
                    Math.min(pendingTotalPages, pendingSafePage + 1),
                  )
                }
                disabled={pendingSafePage >= pendingTotalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Balance table */}
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${
          sectionFilter === "all" || sectionFilter === "pending"
            ? ""
            : "hidden"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <h3 className="text-base font-bold text-rose-600">
              Pending balance
            </h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={balanceSearch}
              onChange={(e) => {
                setBalanceSearch(e.target.value);
                setBalancePage(1);
              }}
              placeholder="Search patient, EMR or mobile"
              className="w-full sm:w-72 pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
            />
          </div>
        </div>

        {balanceError && (
          <div className="mx-5 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            {balanceError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500">
                  Patient
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Pending balance
                </th>
                <th className="w-28 px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedBalancePatients.map((p) => (
                <tr
                  key={p.patientId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <PatientAvatar name={p.patientName} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">
                          {p.patientName || "Unknown"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                          {p.emrNumber && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                              EMR: {p.emrNumber}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {p.invoiceCount} invoice
                            {p.invoiceCount === 1 ? "" : "s"} · {p.itemCount}{" "}
                            item{p.itemCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-base font-bold text-rose-600 whitespace-nowrap">
                    {fmtCurrency(p.totalPending)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedBalancePatient(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredBalancePatients.length && !balanceLoading && (
                <tr>
                  <td
                    className="px-5 py-8 text-sm text-gray-400 text-center"
                    colSpan={3}
                  >
                    {balanceSearch.trim()
                      ? "No patients match your search."
                      : "No pending balances found for the selected date range."}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredBalancePatients.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Total ({balancePatients.length} patient
                    {balancePatients.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-rose-700">
                    {fmtCurrency(balanceTotals?.totalPending)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer — showing counter + pagination */}
        {filteredBalancePatients.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Showing {(balanceSafePage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                balanceSafePage * PAGE_SIZE,
                filteredBalancePatients.length,
              )}{" "}
              of {filteredBalancePatients.length} patient
              {filteredBalancePatients.length === 1 ? "" : "s"}
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() =>
                  setBalancePage(Math.max(1, balanceSafePage - 1))
                }
                disabled={balanceSafePage <= 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {balanceTotalPages > 1 && (
                <span className="text-xs text-gray-500">
                  Page {balanceSafePage} of {balanceTotalPages}
                </span>
              )}
              <button
                onClick={() =>
                  setBalancePage(
                    Math.min(balanceTotalPages, balanceSafePage + 1),
                  )
                }
                disabled={balanceSafePage >= balanceTotalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View modal — full advance details for one patient */}
      {selectedPatient &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Advance details — {selectedPatient.patientName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {`EMR: ${selectedPatient.emrNumber || "—"}`}
                    {selectedPatient.lastPaymentDate
                      ? ` · Last payment: ${formatDateTime(selectedPatient.lastPaymentDate)}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* Summary cards — Total advance + Remaining + Payments */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-5">
                    <div className="text-sm text-gray-500">Total advance</div>
                    <div className="mt-1 text-3xl font-bold text-teal-700">
                      {fmtCurrency(selectedPatient.totalAdvance)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 p-5">
                    <div className="text-sm text-gray-500">
                      Remaining balance
                    </div>
                    <div className="mt-1 text-3xl font-bold text-emerald-600">
                      {fmtCurrency(selectedPatient.remainingAdvance)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 p-5">
                    <div className="text-sm text-gray-500">Payments</div>
                    <div className="mt-1 text-3xl font-bold text-gray-900">
                      {selectedPatient.paymentCount}
                    </div>
                  </div>
                </div>

                {/* One aligned row per advance payment — multiple payments
                    of the same patient stack like the requested design */}
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className={`${PAYMENT_TABLE_GRID} px-4 pb-2`}>
                      <div className="text-xs font-medium text-gray-500">
                        Patient name
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        EMR
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Advance amount
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Transaction ID
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Attachment
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {(selectedPatient.payments || []).map((pay) => {
                        const methods =
                          (pay.multiplePayments || []).filter(
                            (m) => m && m.paymentMethod,
                          ).length > 0
                            ? pay.multiplePayments
                            : pay.paymentMethod
                              ? [
                                  {
                                    paymentMethod: pay.paymentMethod,
                                    amount: pay.advanceAmount,
                                  },
                                ]
                              : [];
                        return (
                          <div
                            key={pay._id}
                            className="rounded-xl border border-gray-200 hover:bg-gray-50/40 transition-colors"
                          >
                            <div className={`${PAYMENT_TABLE_GRID} px-4 py-3`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <PatientAvatar
                                  name={selectedPatient.patientName}
                                />
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {selectedPatient.patientName || "Unknown"}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 pt-2">
                                {selectedPatient.emrNumber || "—"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-emerald-600">
                                    +{fmtCurrency(pay.advanceAmount)}
                                  </span>
                                  {methods.map((m, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-medium text-emerald-700"
                                    >
                                      {m.paymentMethod}
                                      {methods.length > 1 && m.amount > 0
                                        ? ` ${fmtCurrency(m.amount)}`
                                        : ""}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-1.5">
                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600">
                                    {formatDateTime(pay.date)}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] font-mono text-gray-400">
                                  {pay.invoiceNumber || "—"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-2 min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {pay.transactionId || "—"}
                                </span>
                                {pay.transactionId && (
                                  <CopyLink
                                    value={pay.transactionId}
                                    copied={copiedTxn === pay.transactionId}
                                    onCopy={copyTxn}
                                  />
                                )}
                              </div>
                              <div className="pt-1.5">
                                <AttachmentCell url={pay.attachment} />
                              </div>
                            </div>
                            {pay.notes && (
                              <div className="px-4 pb-3 text-xs text-gray-500">
                                <span className="font-medium text-gray-600">
                                  Notes:
                                </span>{" "}
                                {pay.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Total advance ({selectedPatient.paymentCount} payment
                  {selectedPatient.paymentCount === 1 ? "" : "s"})
                </span>
                <span className="text-2xl font-bold text-teal-700">
                  {fmtCurrency(selectedPatient.totalAdvance)}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Pending clearance View modal — full clearance details for one patient */}
      {selectedPendingPatient &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Pending clearance — {selectedPendingPatient.patientName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {`EMR: ${selectedPendingPatient.emrNumber || "—"}`}
                    {selectedPendingPatient.lastClearanceDate
                      ? ` · Last clearance: ${formatDateTime(selectedPendingPatient.lastClearanceDate)}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPendingPatient(null)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* Summary cards — Total cleared + Clearances */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-sky-50 p-5">
                    <div className="text-sm text-gray-500">Total cleared</div>
                    <div className="mt-1 text-3xl font-bold text-amber-700">
                      {fmtCurrency(selectedPendingPatient.totalCleared)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 p-5">
                    <div className="text-sm text-gray-500">Clearances</div>
                    <div className="mt-1 text-3xl font-bold text-gray-900">
                      {selectedPendingPatient.clearanceCount}
                    </div>
                  </div>
                </div>

                {/* One aligned row per clearance — multiple clearances of
                    the same patient stack like the requested design */}
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className={`${PAYMENT_TABLE_GRID} px-4 pb-2`}>
                      <div className="text-xs font-medium text-gray-500">
                        Patient name
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        EMR
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Pending clearance
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Transaction ID
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        Attachment
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {(selectedPendingPatient.clearances || []).map((c) => {
                        const methods = clearanceMethodChips(c);
                        return (
                          <div
                            key={c._id}
                            className="rounded-xl border border-gray-200 hover:bg-gray-50/40 transition-colors"
                          >
                            <div className={`${PAYMENT_TABLE_GRID} px-4 py-3`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <PatientAvatar
                                  name={selectedPendingPatient.patientName}
                                />
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {selectedPendingPatient.patientName ||
                                    "Unknown"}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 pt-2">
                                {selectedPendingPatient.emrNumber || "—"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-amber-600">
                                    {fmtCurrency(c.clearanceAmount)}
                                  </span>
                                  {methods.map((m, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[11px] font-medium text-amber-700"
                                    >
                                      {m.paymentMethod}
                                      {methods.length > 1 && m.amount > 0
                                        ? ` ${fmtCurrency(m.amount)}`
                                        : ""}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-600">
                                    {formatDateTime(c.date)}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    {c.entryCount} item
                                    {c.entryCount === 1 ? "" : "s"} cleared
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 min-w-0">
                                  <span className="text-[11px] font-mono text-gray-400 truncate">
                                    {c.invoiceNumber || "—"}
                                  </span>
                                  {c.treatment && (
                                    <span className="text-[11px] text-gray-500 truncate">
                                      · {c.treatment}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-2 min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                  {c.transactionId || "—"}
                                </span>
                                {c.transactionId && (
                                  <CopyLink
                                    value={c.transactionId}
                                    copied={copiedTxn === c.transactionId}
                                    onCopy={copyTxn}
                                  />
                                )}
                              </div>
                              <div className="pt-1.5">
                                <AttachmentCell url={c.attachment} />
                              </div>
                            </div>
                            {c.notes && !isSystemClearanceNote(c.notes) && (
                              <div className="px-4 pb-3 text-xs text-gray-500">
                                <span className="font-medium text-gray-600">
                                  Notes:
                                </span>{" "}
                                {c.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Total cleared ({selectedPendingPatient.clearanceCount}{" "}
                  transaction
                  {selectedPendingPatient.clearanceCount === 1 ? "" : "s"})
                </span>
                <span className="text-2xl font-bold text-amber-700">
                  {fmtCurrency(selectedPendingPatient.totalCleared)}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Pending balance View modal — mirrors the patient-profile overview:
          the "Pending Payment" amount card + the per-treatment "Pending
          Breakdown" panel (label / invoice / status / remaining / paid). */}
      {selectedBalancePatient &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Pending Balance — {selectedBalancePatient.patientName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    EMR: {selectedBalancePatient.emrNumber || "—"}
                    {selectedBalancePatient.lastPendingDate
                      ? ` · Last invoice: ${formatDateTime(selectedBalancePatient.lastPendingDate)}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBalancePatient(null)}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4">
                {/* Pending amount — the same total the patient profile's
                    "Pending Payment" card shows */}
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-700 font-medium">
                        Pending Payment
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        {fmtCurrency(selectedBalancePatient.totalPending)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {selectedBalancePatient.invoiceCount} invoice
                    {selectedBalancePatient.invoiceCount === 1 ? "" : "s"} ·{" "}
                    {selectedBalancePatient.itemCount} item
                    {selectedBalancePatient.itemCount === 1 ? "" : "s"}
                  </div>
                </div>

                {/* Pending breakdown — per-treatment rows exactly like the
                    profile view's "Pending Breakdown" panel */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                      Pending Breakdown
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900">
                      {(selectedBalancePatient.pendingBreakdown || []).length}
                    </span>
                  </div>
                  <div className="divide-y divide-amber-100 max-h-[45vh] overflow-y-auto">
                    {(selectedBalancePatient.pendingBreakdown || []).map(
                      (item) => {
                        const isPartial = item.status === "Partial";
                        return (
                          <div
                            key={item.ledgerId}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-800 truncate">
                                {pendingItemLabel(item)}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-gray-500 font-mono">
                                  {item.invoiceNumber || "—"}
                                </span>
                                <span
                                  className={
                                    "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide " +
                                    (isPartial
                                      ? "bg-amber-200 text-amber-800"
                                      : "bg-rose-200 text-rose-800")
                                  }
                                >
                                  {item.status}
                                </span>
                                {item.date && (
                                  <span className="text-[11px] text-gray-400">
                                    {formatDateTime(item.date)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <div className="text-sm font-bold text-rose-600">
                                {fmtCurrency(item.remainingAmount)}
                              </div>
                              {isPartial &&
                                Number(item.paidAmount || 0) > 0 && (
                                  <div className="text-[10px] text-emerald-600 font-semibold">
                                    Paid {fmtCurrency(item.paidAmount)}
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      },
                    )}
                    {!(selectedBalancePatient.pendingBreakdown || []).length && (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No pending items found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Total Pending ({selectedBalancePatient.itemCount} item
                  {selectedBalancePatient.itemCount === 1 ? "" : "s"})
                </span>
                <span className="text-lg font-bold text-red-600">
                  {fmtCurrency(selectedBalancePatient.totalPending)}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
