import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import PettyCashTab from "./PettyCashTab";
import BillingTab from "./BillingTab";
import ProductSaleTab from "./ProductSaleTab";
import ManualPettyCashTab from "./ManualPettyCashTab";
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
import DashboardTab from "./DashboardTab";

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
  const { clinic } = useClinic();
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
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

  useEffect(() => {
    setActiveTab(currentTab as any);
  }, [currentTab]);

  return (
    <div>
      <div className="zfm-body min-h-screen bg-[#F8F5EF] dark:bg-[#0b1512] transition-colors duration-300">
        <style>{FONTS}</style>

        {/* Header — flat, solid surface, no gradient blobs */}
        <div className="bg-white dark:bg-[#111d19] border-b border-[#EDE7DA] dark:border-[#1a2622] transition-colors duration-300">
          <div className="w-full px-6 sm:px-10 pt-8 pb-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-teal-600 dark:bg-teal-500 shrink-0">
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
                className="flex items-center gap-2 rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#16231f] px-5 py-2.5 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-[#F8F5EF] dark:hover:bg-[#1c2a25] transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                New Transaction
              </button>
            </div> */}
          </div>
          <div className="w-full px-6 sm:px-10 pb-4">
            <div className="inline-flex items-center gap-1 bg-[#F8F5EF] dark:bg-[#0d1613] rounded-full p-1">
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
                      ? "bg-white dark:bg-[#16231f] text-teal-700 dark:text-teal-300 shadow-sm"
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
            {/* {activeTab === "overview" && (
              <OverviewTab
                isDark={isDark}
                onTabChange={(tab) => setActiveTab(tab as any)}
                permissionData={permissionData}
              />
            )} */}
            {/* Dashboard Tab */}
            {activeTab === "overview" && (
              <DashboardTab permissionData={permissionData} />
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
