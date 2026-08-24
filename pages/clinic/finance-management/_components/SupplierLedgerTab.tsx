import React, { useState } from "react";
import {
  Loader2,
  Inbox,
  Receipt,
  DollarSign,
  FileCheck2,
  CheckCircle2,
  Clock,
  Banknote,
  Landmark,
  CreditCard,
  Globe,
  Wallet,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import useSupplierLedger from "../_hooks/useSupplierLedger";
import useSuppliers from "@/hooks/useSuppliers";
import useClinic from "@/hooks/useClinic";
import StatCard from "./StatCard";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";

const formatDate = (d?: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ============================================================
// STATUS META — shared across bills/payments/cheques rows
// ============================================================
const BILL_STATUS_META: Record<
  string,
  { text: string; bg: string; dot: string }
> = {
  draft: {
    text: "text-stone-600 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800",
    dot: "bg-stone-400",
  },
  pending: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
    dot: "bg-amber-500",
  },
  upcoming: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
    dot: "bg-sky-500",
  },
  partial: {
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950",
    dot: "bg-violet-500",
  },
  paid: {
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
    dot: "bg-teal-500",
  },
  overdue: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
  cancelled: {
    text: "text-stone-400 dark:text-stone-500",
    bg: "bg-stone-100 dark:bg-stone-800",
    dot: "bg-stone-300",
  },
  issued: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
    dot: "bg-sky-500",
  },
  presented: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
    dot: "bg-amber-500",
  },
  cleared: {
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
    dot: "bg-teal-500",
  },
  returned: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
  bounced: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
};

function StatusDot({ status }: { status: string }) {
  const s = BILL_STATUS_META[status] || BILL_STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const METHOD_ICON: Record<string, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Landmark,
  cheque: FileCheck2,
  card: CreditCard,
  online: Globe,
  petty_cash: Wallet,
};

// ============================================================
// SUPPLIER PICKER
// ============================================================
function SupplierPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { clinic } = useClinic();
  const [search, setSearch] = useState("");
  const { suppliers, loading } = useSuppliers({
    branchId: clinic?._id || "",
    search,
  }) as {
    suppliers: {
      _id: string;
      name: string;
      code: string;
      mobile?: string;
      telephone?: string;
      totalBalance?: number;
    }[];
    loading: boolean;
  };

  const options = suppliers.map((s) => ({
    value: s._id,
    label: s.name,
    sublabel: [
      s.code,
      s.mobile || s.telephone,
      s.totalBalance ? `Balance ${formatMoney(s.totalBalance, "INR")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="max-w-md">
      <SearchableSelect
        label="Supplier"
        icon={<Building2 className="w-3.5 h-3.5 text-stone-400" />}
        options={options}
        value={value}
        onChange={onChange}
        onSearchChange={setSearch}
        loading={loading}
        placeholder="Search and choose a supplier"
        searchPlaceholder="Search by name, code, phone…"
        emptyText="No suppliers found"
      />
    </div>
  );
}

// ============================================================
// MAIN TAB
// ============================================================
const SupplierLedgerTab: React.FC = () => {
  const { currency } = useCurrency();
  const [supplierId, setSupplierId] = useState<string>("");
  const { supplier, bills, payments, cheques, summary, loading, error } =
    useSupplierLedger(supplierId || null);

  return (
    <div className="space-y-7">
      <div>
        <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
          Vendor History
        </h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
          Every bill, payment, and cheque for a single supplier — in one place
        </p>
      </div>

      <SupplierPicker value={supplierId} onChange={setSupplierId} />

      {!supplierId && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-stone-400 dark:text-stone-500">
          <Building2 className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
          <span className="text-sm">
            Choose a supplier above to see their full ledger.
          </span>
        </div>
      )}

      {supplierId && loading && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-stone-400 dark:text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
          <span className="text-sm">Loading ledger…</span>
        </div>
      )}

      {supplierId && !loading && error && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {supplierId && !loading && !error && supplier && (
        <>
          {/* Supplier header card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                style={{
                  backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                }}
              >
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
                  {supplier.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  <span className="zfm-mono">{supplier.code}</span>
                  {(supplier.mobile || supplier.telephone) && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />{" "}
                      {supplier.mobile || supplier.telephone}
                    </span>
                  )}
                  {supplier.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {supplier.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {supplier.creditDays !== undefined && (
              <div className="text-right">
                <div className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                  Credit Days
                </div>
                <div className="zfm-mono text-lg font-semibold text-stone-800 dark:text-stone-100">
                  {supplier.creditDays}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Billed"
              value={formatMoney(summary.totalBilled, currency)}
              icon={<Receipt />}
              fromColor="#7c3aed"
              toColor="#8b5cf6"
              iconColor="text-white"
              trend={`${summary.billCount} bills`}
              trendPositive={true}
            />
            <StatCard
              label="Total Paid"
              value={formatMoney(summary.totalPaid, currency)}
              icon={<CheckCircle2 />}
              fromColor="#0d9488"
              toColor="#14b8a6"
              iconColor="text-white"
              trend={`${summary.totalPayments} payments`}
              trendPositive={true}
            />
            <StatCard
              label="Balance Due"
              value={formatMoney(summary.totalBalance, currency)}
              icon={<Clock />}
              fromColor="#d97706"
              toColor="#f59e0b"
              iconColor="text-white"
              trend={`${summary.overdueCount} overdue`}
              trendPositive={summary.overdueCount === 0}
            />
            <StatCard
              label="Cheques"
              value={summary.totalCheques}
              icon={<FileCheck2 />}
              fromColor="#4f46e5"
              toColor="#6366f1"
              iconColor="text-white"
              trend={
                summary.bouncedCheques > 0
                  ? `${summary.bouncedCheques} bounced`
                  : `${summary.pendingCheques} pending`
              }
              trendPositive={summary.bouncedCheques === 0}
            />
          </div>

          {/* Bills */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Bills
              </h3>
            </div>
            {bills.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No bills yet
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {bills.map((b) => (
                  <div
                    key={b._id}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                        {b.category}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
                        {b.invoiceNumber}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        Due {formatDate(b.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusDot status={b.status} />
                      <span className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {formatMoney(b.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Payments
              </h3>
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No payments yet
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {payments.map((p) => {
                  const Icon = METHOD_ICON[p.method] || Banknote;
                  const invoiceNumber =
                    typeof p.transactionId === "string"
                      ? p.transactionId
                      : p.transactionId?.invoiceNumber;
                  return (
                    <div
                      key={p._id}
                      className="px-5 py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-100 zfm-mono">
                          {p.paymentNumber}
                        </span>
                        {invoiceNumber && (
                          <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
                            → {invoiceNumber}
                          </span>
                        )}
                        <span className="text-xs text-stone-400 dark:text-stone-500">
                          {formatDate(p.date)}
                        </span>
                        {p.reversed && (
                          <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                            Reversed
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono text-sm font-semibold shrink-0 ${
                          p.reversed
                            ? "text-stone-400 dark:text-stone-500 line-through"
                            : "text-teal-600 dark:text-teal-400"
                        }`}
                      >
                        {formatMoney(p.amount, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cheques */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Cheques
              </h3>
            </div>
            {cheques.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No cheques yet
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {cheques.map((c) => (
                  <div
                    key={c._id}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-stone-800 dark:text-stone-100 zfm-mono">
                        #{c.chequeNumber}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {c.bank}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {formatDate(c.chequeDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusDot status={c.status} />
                      <span className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {formatMoney(c.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierLedgerTab;
