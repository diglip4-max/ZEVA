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

type DepartmentRow = {
  departmentId: string | null;
  departmentName: string;
  totalRevenue: number;
  totalBookings: number;
  avgPrice: number;
};

type ServiceRow = {
  serviceName: string;
  totalRevenue: number;
  totalBookings: number;
  averagePrice: number;
};

type TopServicesMap = Record<string, ServiceRow[]>;

type HeadersRecord = Record<string, string>;

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

export default function DepartmentReport({ startDate, endDate, headers }: Props) {
  const [loading, setLoading] = useState(false);
  const [deptData, setDeptData] = useState<DepartmentRow[]>([]);
  const [topServices, setTopServices] = useState<TopServicesMap>({});
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceSort, setServiceSort] = useState<"revenue" | "bookings">("revenue");

  useEffect(() => {
    fetchDepartmentPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchServices(selectedDeptId, serviceSort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeptId, serviceSort, startDate, endDate]);

  async function fetchDepartmentPerformance() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ startDate, endDate, top: "3" }).toString();
      const res = await fetch(`/api/clinic/reports/department-performance?${qs}`, {
        headers,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return;
      }
      const departments: DepartmentRow[] = json?.data?.departments || [];
      const topDepartments: DepartmentRow[] = json?.data?.topDepartments || [];
      const servicesByDepartment: TopServicesMap = json?.data?.servicesByDepartment || {};
      setDeptData(departments);
      setTopServices(servicesByDepartment);
      if (!selectedDeptId && topDepartments.length) {
        setSelectedDeptId(String(topDepartments[0].departmentId));
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchServices(departmentId: string, sortBy: "revenue" | "bookings") {
    const qs = new URLSearchParams({ departmentId, sortBy, startDate, endDate }).toString();
    const res = await fetch(`/api/clinic/reports/service-performance?${qs}`, {
      headers,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return;
    }
    setServices(json.data || []);
  }

  const chartData = useMemo(
    () =>
      (deptData || []).map((d) => ({
        name: d.departmentName || "Unassigned",
        revenue: Math.round(d.totalRevenue || 0),
        bookings: d.totalBookings || 0,
        id: d.departmentId ? String(d.departmentId) : "",
      })),
    [deptData]
  );

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Department Performance</h2>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="w-full" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip formatter={(v: any) => currency(Number(v || 0))} />
              <Bar dataKey="revenue" fill="#2D9AA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Departments</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {deptData.slice(0, 3).map((d) => {
            const deptId = d.departmentId ? String(d.departmentId) : "";
            const svc = topServices[deptId] || [];
            return (
              <div key={deptId || d.departmentName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{d.departmentName}</div>
                    <div className="text-sm text-gray-600">{d.totalBookings} bookings</div>
                  </div>
                  <div className="text-right font-semibold">{currency(d.totalRevenue)}</div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">Top services</div>
                  <ul className="space-y-1">
                    {svc.slice(0, 5).map((s) => (
                      <li key={`${deptId}-${s.serviceName}`} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{s.serviceName}</span>
                        <span className="text-gray-900 font-medium">{currency(s.totalRevenue)}</span>
                      </li>
                    ))}
                    {!svc.length && <li className="text-sm text-gray-500">No services found</li>}
                  </ul>
                </div>
                <div className="mt-3">
                  <button
                    className="text-sm text-[#2D9AA5] hover:underline"
                    onClick={() => setSelectedDeptId(deptId)}
                  >
                    View service performance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Service Performance</h3>
            <p className="text-xs text-gray-500">Fields: Service Name, Total Bookings, Total Revenue, Average Price</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Department</label>
            <select
              value={selectedDeptId || ""}
              onChange={(e) => setSelectedDeptId(e.target.value || null)}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="">Select</option>
              {deptData
                .filter((d) => d.departmentId)
                .map((d) => (
                  <option key={String(d.departmentId)} value={String(d.departmentId)}>
                    {d.departmentName}
                  </option>
                ))}
            </select>
            <label className="text-sm text-gray-700">Most Popular Services</label>
            <select
              value={serviceSort}
              onChange={(e) => setServiceSort(e.target.value as "revenue" | "bookings")}
              className="border rounded px-2 py-1 bg-white"
            >
              <option value="bookings">Highest bookings</option>
              <option value="revenue">Highest revenue</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Service Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Total Bookings
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Average Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.serviceName}>
                  <td className="px-4 py-2 text-sm text-gray-800">{s.serviceName}</td>
                  <td className="px-4 py-2 text-sm">{s.totalBookings}</td>
                  <td className="px-4 py-2 text-sm font-medium">{currency(s.totalRevenue)}</td>
                  <td className="px-4 py-2 text-sm">{currency(s.averagePrice)}</td>
                </tr>
              ))}
              {!services.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500" colSpan={4}>
                    Select a department to view service performance
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
