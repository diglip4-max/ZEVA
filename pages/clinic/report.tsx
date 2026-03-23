import React, { useMemo, useState } from "react";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import dayjs from "dayjs";
import dynamic from "next/dynamic";

const DepartmentReport = dynamic(() => import("../../components/reports/DepartmentReport"), { ssr: false });
const PackageReport = dynamic(() => import("../../components/reports/PackageReport"), { ssr: false });
const MembershipReport = dynamic(() => import("../../components/reports/MembershipReport"), { ssr: false });
const AppointmentReport = dynamic(() => import("../../components/reports/AppointmentReport"), { ssr: false });
const PatientReport = dynamic(() => import("../../components/reports/PatientReport"), { ssr: false });
const LeadReport = dynamic(() => import("../../components/reports/LeadReport"), { ssr: false });
const DoctorStaffReport = dynamic(() => import("../../components/reports/DoctorStaffReport"), { ssr: false });
const RevenueReport = dynamic(() => import("../../components/reports/RevenueReport"), { ssr: false });
const RoomResourceReport = dynamic(() => import("../../components/reports/RoomResourceReport"), { ssr: false });
const StockReport = dynamic(() => import("../../components/reports/StockReport"), { ssr: false });

function ReportPage() {
  const [activeTab, setActiveTab] = useState<
    "department" | "package" | "membership" | "appointment" | "patient" | "lead" | "doctorStaff" | "rooms" | "revenue" | "stock"
  >("department");
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("clinicToken") ||
        sessionStorage.getItem("clinicToken") ||
        localStorage.getItem("agentToken") ||
        sessionStorage.getItem("agentToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken")
      : "";

  const headers = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    }),
    [token]
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Clinic Reports</h1>
        <p className="text-gray-600">Analyze department, packages and membership performance</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-lg bg-white shadow">
          <button
            className={`px-4 py-2 rounded-l-lg ${activeTab === "department" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("department")}
          >
            Department
          </button>
          <button
            className={`px-4 py-2 ${activeTab === "package" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("package")}
          >
            Package
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "membership" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("membership")}
          >
            Membership
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "appointment" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("appointment")}
          >
            Appointment
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "patient" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("patient")}
          >
            Patient
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "lead" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("lead")}
          >
            Lead
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "doctorStaff" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("doctorStaff")}
          >
            Doctor Staff
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "revenue" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("revenue")}
          >
            Revenue
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "rooms" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("rooms")}
          >
            Rooms
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${activeTab === "stock" ? "bg-[#2D9AA5] text-white" : "text-gray-700"}`}
            onClick={() => setActiveTab("stock")}
          >
            Stock
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm text-gray-700">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2 bg-white"
          />
          <label className="text-sm text-gray-700">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2 bg-white"
          />
        </div>
      </div>

      {activeTab === "department" && <DepartmentReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "package" && <PackageReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "membership" && <MembershipReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "appointment" && <AppointmentReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "patient" && <PatientReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "lead" && <LeadReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "doctorStaff" && <DoctorStaffReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "revenue" && <RevenueReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "rooms" && <RoomResourceReport startDate={startDate} endDate={endDate} headers={headers} />}
      {activeTab === "stock" && <StockReport startDate={startDate} endDate={endDate} headers={headers} />}
    </div>
  );
}

ReportPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const Protected = withClinicAuth(ReportPage as any);
(Protected as any).getLayout = ReportPage.getLayout;

export default Protected;
