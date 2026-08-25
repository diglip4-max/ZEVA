import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import PettyCashTab from "./PettyCashTab";
import BillingTab from "./BillingTab";
import ProductSaleTab from "./ProductSaleTab";
import ManualPettyCashTab from "./ManualPettyCashTab";
import OverviewTab from "./OverviewTab";
import { useClinicTheme } from "@/context/ClinicThemeContext";
import useClinic from "@/hooks/useClinic";
import BillsPayableTab from "./BillsPayableTab";
import FinancePaymentsTab from "./FinancePaymentsTab";
import FinanceChequesTab from "./FinanceChequesTab";
import ExpensesTab from "./ExpensesTab";
import SupplierLedgerTab from "./SupplierLedgerTab";
import ReportsTab from "./ReportsTab";
import BankAccountsTab from "./BankAccountsTab";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import useFinancePermission from "../_hooks/useFinancePermission";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.zfm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
.zfm-body { font-family: 'Manrope', sans-serif; }
.zfm-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
`;

export default function FinanceManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("view") || "overview";
  const { theme } = useClinicTheme();
  const isDark = theme === "dark";
  const { clinic } = useClinic();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "transactions"
    | "invoices"
    | "categories"
    | "billing"
    | "pettyCash"
    | "manualPettyCash"
    | "productSales"
    | "billsPayable"
    | "expenses"
    | "payments"
    | "bankAccounts"
    | "cheques"
    | "vendorHistory"
    | "reports"
  >(currentTab as any);

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    // { id: "transactions", label: "Transactions" },
    // { id: "invoices", label: "Invoices" },
    // { id: "categories", label: "Expense Categories" },
    // { id: "billing", label: "Billing" },
    // { id: "manualPettyCash", label: "Manual Petty Cash" },
    // { id: "productSales", label: "Product Sales" },
    { id: "billsPayable", label: "Bills & Payables" },
    { id: "expenses", label: "Expenses" },
    { id: "payments", label: "Payments" },
    { id: "pettyCash", label: "Petty Cash" },
    { id: "bankAccounts", label: "Bank Accounts" },
    { id: "cheques", label: "Cheque Manager" },
    { id: "vendorHistory", label: "Vendor History" },
    { id: "reports", label: "Reports" },
  ];

  const parentModuleKey = "clinic_finance_management";
  const moduleKey = useMemo(() => {
    if (activeTab === "overview") {
      return "clinic_finance_overview";
    } else if (activeTab === "billsPayable") {
      return "clinic_finance_bills_payables";
    } else if (activeTab === "expenses") {
      return "clinic_finance_expenses";
    } else if (activeTab === "payments") {
      return "clinic_finance_payments";
    } else if (activeTab === "pettyCash") {
      return "clinic_finance_petty_cash";
    } else if (activeTab === "bankAccounts") {
      return "clinic_finance_bank_accounts";
    } else if (activeTab === "cheques") {
      return "clinic_finance_cheque_manager";
    } else if (activeTab === "vendorHistory") {
      return "clinic_finance_vendor_history";
    } else if (activeTab === "reports") {
      return "clinic_finance_reports";
    }

    return `clinic_finance_${activeTab}`;
  }, [activeTab]);
  const permissionData = useFinancePermission({
    moduleKey,
    parentModuleKey,
  });

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

          <div className="relative w-full px-6 sm:px-10 pt-8 pb-5 flex items-center justify-between flex-wrap gap-4">
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
            {/* <div className="flex items-center gap-3">
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
            </div> */}
          </div>
          <div className="relative w-full px-6 sm:px-10 pb-4">
            <div className="inline-flex items-center gap-1 bg-stone-100 dark:bg-gray-900 rounded-full p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);

                    router.push(
                      `/clinic/finance-management?view=${t.id}`,
                      undefined,
                      {
                        shallow: true, // Prevents re-fetching if data is already loaded
                      },
                    );
                  }}
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
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <OverviewTab
                isDark={isDark}
                onTabChange={(tab) => setActiveTab(tab as any)}
                permissionData={permissionData}
              />
            )}

            {/* Billing Tab */}
            {activeTab === "billing" && <BillingTab />}

            {/* Petty Cash Tab */}
            {activeTab === "pettyCash" && <PettyCashTab {...permissionData} />}

            {/* Manual Petty Cash Tab */}
            {activeTab === "manualPettyCash" && <ManualPettyCashTab />}

            {/* Product Sales Tab */}
            {activeTab === "productSales" && <ProductSaleTab />}

            {/* Bills Payable Tab */}
            {activeTab === "billsPayable" && (
              <BillsPayableTab {...permissionData} />
            )}

            {/* Expenses Tab */}
            {activeTab === "expenses" && <ExpensesTab {...permissionData} />}

            {/* Payments Tab */}
            {activeTab === "payments" && (
              <FinancePaymentsTab {...permissionData} />
            )}

            {/* Bank Accounts Tab */}
            {activeTab === "bankAccounts" && (
              <BankAccountsTab {...permissionData} />
            )}

            {/* Cheques Tab */}
            {activeTab === "cheques" && (
              <FinanceChequesTab {...permissionData} />
            )}

            {/* Vendor History Tab */}
            {activeTab === "vendorHistory" && (
              <SupplierLedgerTab {...permissionData} />
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && <ReportsTab {...permissionData} />}
          </>
        </div>
      </div>
    </div>
  );
}
