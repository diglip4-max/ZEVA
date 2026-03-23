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
import ExportButtons from "./ExportButtons";

type HeadersRecord = { [key: string]: string | undefined };

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

interface TopRow {
  membershipName: string;
  totalRevenue: number;
  count: number;
}

interface Row {
  membershipName: string;
  patientName: string;
  doctorName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  totalRevenue: number;
}

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

export default function MembershipReport({ startDate, endDate, headers }: Props) {
  const [top, setTop] = useState<TopRow[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [detail, setDetail] = useState<{ open: boolean; data?: any; membershipName?: string; patientId?: string }>(
    { open: false }
  );

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData(p: number) {
    const qs = new URLSearchParams({ startDate, endDate, page: String(p), limit: "20" }).toString();
    const res = await fetch(`/api/clinic/reports/membership-performance?${qs}`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setTop([]);
      setRows([]);
      setHasNext(false);
      return;
    }
    setTop(json.data?.top || []);
    setRows(json.data?.rows || []);
    setHasNext(Boolean(json.data?.pagination?.hasNext));
    setPage(p);
  }

  const chartData = useMemo(
    () =>
      (top || []).map((t) => ({
        name: t.membershipName || "Unnamed",
        revenue: Math.round(t.totalRevenue || 0),
        count: t.count || 0,
      })),
    [top]
  );

  const membershipExportData = useMemo(() => {
    // Combine top memberships and active memberships
    const topMemberships = top.map(t => ({
      "Type": "Top Membership (Revenue)",
      "Membership Name": t.membershipName || "Unnamed",
      "Detail": `Count: ${t.count}, Revenue: AED ${Math.round(t.totalRevenue || 0)}`
    }));

    const activeMemberships = rows.map(r => ({
      "Type": "Active Membership",
      "Membership Name": r.membershipName || "-",
      "Detail": `Patient: ${r.patientName || "-"}, Start: ${r.startDate ? new Date(r.startDate).toLocaleDateString() : "-"}, End: ${r.endDate ? new Date(r.endDate).toLocaleDateString() : "-"}, Status: ${r.status}, Revenue: AED ${Math.round(r.totalRevenue || 0)}`
    }));

    return [...topMemberships, ...activeMemberships];
  }, [rows, top]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButtons
          data={membershipExportData}
          filename={`membership_report_${startDate}_to_${endDate}`}
          headers={["Type", "Membership Name", "Detail"]}
          title="Membership Performance Report"
        />
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Top Memberships (Revenue)</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip formatter={(v: number) => currency(v)} />
              <Bar dataKey="revenue" fill="#2D9AA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Membership Reports</h3>
          <div className="flex items-center gap-4">
            <ExportButtons
              data={rows.map(r => ({
                "Membership Name": r.membershipName || "-",
                "Patient Name": r.patientName || "-",
                "Start Date": r.startDate ? new Date(r.startDate).toLocaleDateString() : "-",
                "Expiry Date": r.endDate ? new Date(r.endDate).toLocaleDateString() : "-",
                "Status": r.status || "-",
                "Total Revenue (AED)": Math.round(r.totalRevenue || 0),
              }))}
              filename={`membership_report_${startDate}_to_${endDate}`}
              headers={["Membership Name", "Patient Name", "Start Date", "Expiry Date", "Status", "Total Revenue (AED)"]}
              title="Membership Performance Report"
            />
            <div className="flex items-center gap-2 border-l pl-4">
              <button
                className="px-3 py-1.5 rounded border text-sm"
                disabled={page <= 1}
                onClick={() => fetchData(Math.max(1, page - 1))}
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">Page {page}</span>
              <button
                className="px-3 py-1.5 rounded border text-sm"
                disabled={!hasNext}
                onClick={() => fetchData(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Membership Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Patient Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Expiry Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={`${r.membershipName}-${r.patientName}-${r.startDate}`}>
                  <td className="px-4 py-2 text-sm text-gray-800">{r.membershipName || "-"}</td>
                  <td className="px-4 py-2 text-sm">{r.patientName || "-"}</td>
                  <td className="px-4 py-2 text-sm">
                    {r.startDate ? new Date(r.startDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {r.endDate ? new Date(r.endDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm">{r.status}</td>
                  <td className="px-4 py-2 text-sm font-medium">{currency(r.totalRevenue || 0)}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <button
                      className="px-3 py-1.5 rounded bg-[#2D9AA5] text-white text-xs"
                      onClick={async () => {
                        try {
                          // We need membershipId and patientId; they are present in API rows projection as membershipId, patientId
                          const anyRow: any = r as any;
                          const membershipId = anyRow.membershipId;
                          const patientId = anyRow.patientId || anyRow._id;
                          const qs = new URLSearchParams({
                            queryMembershipId: membershipId || "",
                            endDate: endDate || "",
                          }).toString();
                          const res = await fetch(`/api/clinic/membership-usage/${patientId}?${qs}`, { headers });
                          const json = await res.json();
                          setDetail({
                            open: true,
                            data: json,
                            membershipName: r.membershipName,
                            patientId,
                          });
                        } catch (e) {
                          setDetail({ open: true, data: { error: "Failed to load usage" }, membershipName: r.membershipName });
                        }
                      }}
                    >
                      View Usage
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-4 text-sm text-gray-500" colSpan={7}>
                    No membership data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail.open && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-3xl rounded-t-lg md:rounded-lg shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">
                Membership Usage — {detail.membershipName}
              </div>
              <button
                className="px-3 py-1.5 rounded border text-sm"
                onClick={() => setDetail({ open: false })}
              >
                Close
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {detail.data?.success ? (
                <div className="space-y-3">
                  {detail.data?.transferredOut && (
                    <div className="text-xs text-gray-700">
                      Transferred: Out
                    </div>
                  )}
                  {detail.data?.sourcePatientId && (
                    <div className="text-xs text-gray-700">
                      Transferred From Patient: {detail.data?.sourcePatientName || String(detail.data?.sourcePatientId)}
                    </div>
                  )}
                  {detail.data?.hasFreeConsultations && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 border rounded">
                        <div className="text-xs text-gray-500">Total Free Consultations</div>
                        <div className="text-sm font-medium">{detail.data?.totalFreeConsultations ?? 0}</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="text-xs text-gray-500">Used</div>
                        <div className="text-sm font-medium">{detail.data?.usedFreeConsultations ?? 0}</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="text-xs text-gray-500">Remaining</div>
                        <div className="text-sm font-medium">{detail.data?.remainingFreeConsultations ?? 0}</div>
                      </div>
                    </div>
                  )}
                  {!detail.data?.hasFreeConsultations && (
                    <div className="text-sm text-gray-600">No free consultations in this membership</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-red-600">
                  {detail.data?.message || detail.data?.error || "No data"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
