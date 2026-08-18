import React, { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  CheckCircle2,
  X,
  Receipt,
  Send,
  Sparkles,
} from "lucide-react";
import PettyCashTab from "./PettyCashTab";
import BillingTab from "./BillingTab";
import ProductSaleTab from "./ProductSaleTab";
import ManualPettyCashTab from "./ManualPettyCashTab";
import OverviewTab from "./OverviewTab";
import { useClinicTheme } from "@/context/ClinicThemeContext";
import useClinic from "@/hooks/useClinic";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.zfm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
.zfm-body { font-family: 'Manrope', sans-serif; }
.zfm-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
`;

type PaymentMode =
  | "UPI"
  | "Cash"
  | "Card"
  | "Bank Transfer"
  | "Insurance"
  | "Cheque";
type Status = "Paid" | "Pending" | "Overdue";
type TransactionType = "income" | "expense";

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  mode: PaymentMode;
  type: TransactionType;
  status: Status;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  patient: string;
  amount: number;
  dueDate: string;
  status: Status;
}

interface CategoryBudget {
  name: string;
  spent: number;
  budget: number;
  color: string;
}

interface TransactionForm {
  type: TransactionType;
  amount: string;
  category: string;
  mode: PaymentMode;
  date: string;
  description: string;
  status: Status;
}

const INCOME_CATEGORIES = [
  "Consultation Fee",
  "Pharmacy Sales",
  "Lab Tests",
  "Procedure Charges",
  "Insurance Claim",
];
const EXPENSE_CATEGORIES = [
  "Staff Salaries",
  "Rent",
  "Equipment Purchase",
  "Utilities",
  "Medical Supplies",
  "Marketing",
];
const PAYMENT_MODES: PaymentMode[] = [
  "UPI",
  "Cash",
  "Card",
  "Bank Transfer",
  "Insurance",
  "Cheque",
];

const seedTransactions: Transaction[] = [
  {
    id: "t1",
    date: "2026-08-05",
    description: "OPD consultation — Dr. Rina Kapoor",
    category: "Consultation Fee",
    mode: "UPI",
    type: "income",
    status: "Paid",
    amount: 1200,
  },
  {
    id: "t2",
    date: "2026-08-05",
    description: "Pharmacy counter sales",
    category: "Pharmacy Sales",
    mode: "Cash",
    type: "income",
    status: "Paid",
    amount: 8450,
  },
  {
    id: "t3",
    date: "2026-08-04",
    description: "Front office staff salary — July",
    category: "Staff Salaries",
    mode: "Bank Transfer",
    type: "expense",
    status: "Paid",
    amount: 42000,
  },
  {
    id: "t4",
    date: "2026-08-04",
    description: "Blood panel — patient Meera S.",
    category: "Lab Tests",
    mode: "Insurance",
    type: "income",
    status: "Pending",
    amount: 3200,
  },
  {
    id: "t5",
    date: "2026-08-03",
    description: "Clinic rent — August",
    category: "Rent",
    mode: "Bank Transfer",
    type: "expense",
    status: "Paid",
    amount: 65000,
  },
  {
    id: "t6",
    date: "2026-08-02",
    description: "Minor procedure — suturing",
    category: "Procedure Charges",
    mode: "Card",
    type: "income",
    status: "Paid",
    amount: 2600,
  },
  {
    id: "t7",
    date: "2026-08-01",
    description: "Autoclave sterilizer purchase",
    category: "Equipment Purchase",
    mode: "Cheque",
    type: "expense",
    status: "Paid",
    amount: 28500,
  },
  {
    id: "t8",
    date: "2026-07-30",
    description: "Insurance claim — Bajaj Allianz",
    category: "Insurance Claim",
    mode: "Insurance",
    type: "income",
    status: "Overdue",
    amount: 15400,
  },
  {
    id: "t9",
    date: "2026-07-29",
    description: "Electricity + water bill",
    category: "Utilities",
    mode: "UPI",
    type: "expense",
    status: "Paid",
    amount: 6200,
  },
  {
    id: "t10",
    date: "2026-07-28",
    description: "Consultation — Dr. Arjun Mehta (5 pts)",
    category: "Consultation Fee",
    mode: "Cash",
    type: "income",
    status: "Paid",
    amount: 5000,
  },
  {
    id: "t11",
    date: "2026-07-27",
    description: "Surgical gloves + dressing stock",
    category: "Medical Supplies",
    mode: "UPI",
    type: "expense",
    status: "Paid",
    amount: 9100,
  },
  {
    id: "t12",
    date: "2026-07-26",
    description: "Google local ads — August",
    category: "Marketing",
    mode: "Card",
    type: "expense",
    status: "Pending",
    amount: 4000,
  },
];

const seedInvoices: Invoice[] = [
  {
    id: "i1",
    invoiceNo: "INV-2026-0142",
    patient: "Meera Sharma",
    amount: 3200,
    dueDate: "2026-08-10",
    status: "Pending",
  },
  {
    id: "i2",
    invoiceNo: "INV-2026-0141",
    patient: "Bajaj Allianz (Insurance)",
    amount: 15400,
    dueDate: "2026-07-31",
    status: "Overdue",
  },
  {
    id: "i3",
    invoiceNo: "INV-2026-0140",
    patient: "Rohit Verma",
    amount: 1800,
    dueDate: "2026-08-02",
    status: "Paid",
  },
  {
    id: "i4",
    invoiceNo: "INV-2026-0139",
    patient: "Ananya Iyer",
    amount: 2600,
    dueDate: "2026-08-01",
    status: "Paid",
  },
  {
    id: "i5",
    invoiceNo: "INV-2026-0138",
    patient: "Star Health (Insurance)",
    amount: 9800,
    dueDate: "2026-08-14",
    status: "Pending",
  },
];

const categoryBudgets: CategoryBudget[] = [
  { name: "Staff Salaries", spent: 42000, budget: 45000, color: "#0f766e" },
  { name: "Rent", spent: 65000, budget: 65000, color: "#14b8a6" },
  { name: "Medical Supplies", spent: 9100, budget: 15000, color: "#5eead4" },
  { name: "Equipment Purchase", spent: 28500, budget: 20000, color: "#d97706" },
  { name: "Utilities", spent: 6200, budget: 9000, color: "#99f6e4" },
  { name: "Marketing", spent: 4000, budget: 10000, color: "#a8a29e" },
];

const inr = (n: number): string => "₹" + Math.abs(n).toLocaleString("en-IN");

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { dot: string; text: string; bg: string }> = {
    Paid: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-300",
      bg: "bg-teal-50 dark:bg-teal-950",
    },
    Pending: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    Overdue: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
      bg: "bg-rose-50 dark:bg-rose-950",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

export default function FinanceManager() {
  const { theme } = useClinicTheme();
  const isDark = theme === "dark";
  const { clinic } = useClinic();
  const [transactions, setTransactions] =
    useState<Transaction[]>(seedTransactions);
  const [invoices, setInvoices] = useState<Invoice[]>(seedInvoices);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "transactions"
    | "invoices"
    | "categories"
    | "billing"
    | "pettyCash"
    | "manualPettyCash"
    | "productSales"
  >("overview");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "All">("All");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionForm>({
    type: "income",
    amount: "",
    category: INCOME_CATEGORIES[0],
    mode: "UPI",
    date: "2026-08-06",
    description: "",
    status: "Paid",
  });

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const balances = useMemo(() => {
    const opening = 240000;
    const asc = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    let running = opening;
    const map: Record<string, number> = {};
    asc.forEach((t) => {
      running += t.type === "income" ? t.amount : -t.amount;
      map[t.id] = running;
    });
    return map;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((t) => categoryFilter === "All" || t.category === categoryFilter)
      .filter((t) => statusFilter === "All" || t.status === statusFilter)
      .filter((t) => typeFilter === "All" || t.type === typeFilter)
      .filter(
        (t) =>
          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categoryFilter, statusFilter, typeFilter, searchTerm]);

  const allCategories = ["All", ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

  const markPaid = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "Paid" } : t)),
    );
    showToast("Marked as paid");
  };

  const markInvoicePaid = (id: string) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "Paid" } : i)),
    );
    showToast("Invoice marked as paid");
  };

  const sendReminder = (patient: string) =>
    showToast(`Reminder sent to ${patient}`);

  const addTransaction = () => {
    const amountNum = Number(form.amount);
    if (!form.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    const t: Transaction = {
      id: "t" + Date.now(),
      date: form.date,
      description: form.description || form.category,
      category: form.category,
      mode: form.mode,
      type: form.type,
      status: form.status,
      amount: amountNum,
    };
    setTransactions((prev) => [t, ...prev]);
    setShowAddModal(false);
    setForm({
      type: "income",
      amount: "",
      category: INCOME_CATEGORIES[0],
      mode: "UPI",
      date: "2026-08-06",
      description: "",
      status: "Paid",
    });
    showToast("Transaction added");
  };

  const exportCSV = () => {
    const header = [
      "Date",
      "Description",
      "Category",
      "Mode",
      "Type",
      "Status",
      "Amount",
    ];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.description,
      t.category,
      t.mode,
      t.type,
      t.status,
      String(t.amount),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zeva-finance-transactions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported CSV");
  };

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    // { id: "transactions", label: "Transactions" },
    // { id: "invoices", label: "Invoices" },
    // { id: "categories", label: "Expense Categories" },
    { id: "billing", label: "Billing" },
    { id: "pettyCash", label: "Petty Cash" },
    { id: "manualPettyCash", label: "Manual Petty Cash" },
    { id: "productSales", label: "Product Sales" },
  ];

  return (
    <div>
      <div className="zfm-body min-h-screen transition-colors duration-300">
        <style>{FONTS}</style>

        {/* Header */}
        <div className="relative bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 overflow-hidden transition-colors duration-300">
          <div
            className="absolute -left-20 -top-28 w-80 h-80 rounded-full blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${isDark ? "rgba(45,212,191,0.10)" : "#99f6e4"}, transparent 70%)`,
            }}
          />
          <div
            className="absolute right-0 -top-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${isDark ? "rgba(217,119,6,0.10)" : "#fde68a"}, transparent 70%)`,
            }}
          />

          <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{
                  backgroundImage: "linear-gradient(135deg, #14b8a6, #0f766e)",
                }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-1">
                  {clinic?.name || "Zeva"}
                </div>
                <h1 className="zfm-display text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-none">
                  Finance Manager
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-5 py-2.5 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 hover:shadow-sm transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200"
                style={{
                  backgroundImage: "linear-gradient(135deg, #14b8a6, #0f766e)",
                }}
              >
                <Plus className="w-4 h-4" />
                New Transaction
              </button>
            </div>
          </div>
          <div className="relative max-w-6xl mx-auto px-6 pb-4">
            <div className="inline-flex items-center gap-1 bg-stone-100 dark:bg-gray-900 rounded-full p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                    activeTab === t.id
                      ? "bg-white dark:bg-stone-700 text-teal-700 dark:text-teal-300 shadow-sm"
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full px-6 sm:px-10 py-8 sm:py-10">
          {activeTab === "transactions" && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden transition-colors duration-300">
              <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-stone-300 dark:text-stone-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search description or category…"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as TransactionType | "All")
                  }
                  className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 text-stone-600 dark:text-stone-300 font-medium"
                >
                  <option value="All">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 text-stone-600 dark:text-stone-300 font-medium"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as Status | "All")
                  }
                  className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 text-stone-600 dark:text-stone-300 font-medium"
                >
                  <option value="All">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-stone-400 dark:text-stone-500 uppercase tracking-widest font-bold border-b border-stone-100 dark:border-stone-800">
                      <th className="px-5 py-3.5 font-bold">Date</th>
                      <th className="px-5 py-3.5 font-bold">Description</th>
                      <th className="px-5 py-3.5 font-bold">Category</th>
                      <th className="px-5 py-3.5 font-bold">Mode</th>
                      <th className="px-5 py-3.5 font-bold">Status</th>
                      <th className="px-5 py-3.5 font-bold text-right">
                        Amount
                      </th>
                      <th className="px-5 py-3.5 font-bold text-right">
                        Balance
                      </th>
                      <th className="px-5 py-3.5 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
                    {filteredTransactions.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`${idx % 2 === 1 ? "bg-stone-50 dark:bg-stone-800/60" : "bg-white dark:bg-stone-900"} hover:bg-teal-50 dark:hover:bg-teal-950 transition-colors duration-150`}
                      >
                        <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 zfm-mono text-xs whitespace-nowrap">
                          {t.date}
                        </td>
                        <td className="px-5 py-3.5 text-stone-800 dark:text-stone-100 font-medium">
                          {t.description}
                        </td>
                        <td className="px-5 py-3.5 text-stone-500 dark:text-stone-400">
                          {t.category}
                        </td>
                        <td className="px-5 py-3.5 text-stone-500 dark:text-stone-400">
                          {t.mode}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={t.status} />
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right zfm-mono font-semibold ${t.type === "income" ? "text-teal-600 dark:text-teal-400" : "text-rose-500 dark:text-rose-400"}`}
                        >
                          {t.type === "income" ? "+" : "−"}
                          {inr(t.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-right zfm-mono text-stone-400 dark:text-stone-500">
                          {inr(balances[t.id])}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {t.status !== "Paid" ? (
                            <button
                              onClick={() => markPaid(t.id)}
                              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 whitespace-nowrap hover:underline"
                            >
                              Mark Paid
                            </button>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-teal-200 dark:text-teal-800 ml-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-12 text-center text-stone-400 dark:text-stone-500 text-sm"
                        >
                          No transactions match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundImage:
                            "linear-gradient(135deg,#ccfbf1,#5eead4)",
                        }}
                      >
                        <Receipt className="w-4 h-4 text-teal-700" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-50">
                          {inv.invoiceNo}
                        </div>
                        <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                          {inv.patient}
                        </div>
                      </div>
                    </div>
                    <StatusPill status={inv.status} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-widest mb-1">
                        Amount due
                      </div>
                      <div className="zfm-display text-xl font-semibold text-stone-900 dark:text-stone-50">
                        {inr(inv.amount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-widest mb-1">
                        Due date
                      </div>
                      <div className="text-sm text-stone-600 dark:text-stone-300 zfm-mono">
                        {inv.dueDate}
                      </div>
                    </div>
                  </div>
                  {inv.status !== "Paid" && (
                    <div className="flex gap-2 mt-5 pt-5 border-t border-stone-100 dark:border-stone-800">
                      <button
                        onClick={() => markInvoicePaid(inv.id)}
                        className="flex-1 text-xs font-semibold text-white rounded-full py-2.5 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
                        style={{
                          backgroundImage:
                            "linear-gradient(135deg,#14b8a6,#0f766e)",
                        }}
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => sendReminder(inv.patient)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded-full py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors duration-200"
                      >
                        <Send className="w-3 h-3" /> Send Reminder
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "categories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBudgets.map((c, i) => {
                const pct = Math.min(
                  100,
                  Math.round((c.spent / c.budget) * 100),
                );
                const over = c.spent > c.budget;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-stone-800 dark:text-stone-100">
                        {c.name}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    </div>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="zfm-display text-xl font-semibold text-stone-900 dark:text-stone-50">
                        {inr(c.spent)}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">
                        of {inr(c.budget)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: over ? "#e11d48" : c.color,
                        }}
                      />
                    </div>
                    <div
                      className={`mt-2.5 text-xs font-semibold ${over ? "text-rose-500 dark:text-rose-400" : "text-stone-400 dark:text-stone-500"}`}
                    >
                      {over
                        ? `${pct - 100}% over budget`
                        : `${pct}% of budget used`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <OverviewTab
              isDark={isDark}
              onTabChange={(tab) => setActiveTab(tab as any)}
            />
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && <BillingTab />}

          {/* Petty Cash Tab */}
          {activeTab === "pettyCash" && <PettyCashTab />}

          {/* Manual Petty Cash Tab */}
          {activeTab === "manualPettyCash" && <ManualPettyCashTab />}

          {/* Product Sales Tab */}
          {activeTab === "productSales" && <ProductSaleTab />}
        </div>

        {/* Add Transaction Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
            style={{
              backgroundColor: "rgba(19,42,39,0.5)",
              backdropFilter: "blur(3px)",
            }}
          >
            <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg,#14b8a6,#0f766e)",
                    }}
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-0.5">
                      New Entry
                    </div>
                    <h3 className="zfm-display text-xl font-semibold text-stone-900 dark:text-stone-50">
                      Add Transaction
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-1 mb-5 bg-stone-100 dark:bg-stone-800 rounded-full p-1">
                {(["income", "expense"] as TransactionType[]).map((ty) => (
                  <button
                    key={ty}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        type: ty,
                        category:
                          ty === "income"
                            ? INCOME_CATEGORIES[0]
                            : EXPENSE_CATEGORIES[0],
                      }))
                    }
                    className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      form.type === ty
                        ? "bg-white dark:bg-stone-700 text-teal-700 dark:text-teal-300 shadow-sm"
                        : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    {ty === "income" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-4 py-3 text-lg rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 zfm-mono font-semibold transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Description
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="e.g. OPD consultation"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400"
                    >
                      {(form.type === "income"
                        ? INCOME_CATEGORIES
                        : EXPENSE_CATEGORIES
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Payment Mode
                    </label>
                    <select
                      value={form.mode}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          mode: e.target.value as PaymentMode,
                        }))
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Date
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 zfm-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          status: e.target.value as Status,
                        }))
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 mt-7">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTransaction}
                  className="flex-1 py-3 rounded-full text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                  }}
                >
                  Add Transaction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-800 text-white text-sm font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2 z-50">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
