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

type HeadersRecord = Record<string, string>;

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

type OwnerRow = { ownerId: string; ownerName: string; total: number; converted: number; conversionRatio: number };
type GenderRow = { gender: string; total: number; converted: number; conversionRatio: number };
type TreatmentRow = { treatmentId: string; name: string; converted: number };
type SourceRow = { source: string; total: number; converted: number; conversionRatio: number };
type StatusRow = { status: string; count: number };

export default function LeadReport({ startDate, endDate, headers }: Props) {
  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [genders, setGenders] = useState<GenderRow[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ startDate, endDate }).toString();
      const res = await fetch(`/api/clinic/reports/lead-performance?${qs}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setOwners([]); setGenders([]); setTreatments([]); setSources([]); setStatuses([]);
        return;
      }
      setOwners(json.data?.conversionByOwner || []);
      setGenders(json.data?.genderStats || []);
      setTreatments(json.data?.topTreatments || []);
      setSources(json.data?.topSources || []);
      setStatuses(json.data?.statusDistribution || []);
    } finally {
      setLoading(false);
    }
  }

  const ownersChart = useMemo(
    () =>
      (owners || []).map((o) => ({
        name: o.ownerName || "Unassigned",
        ratio: Math.round((o.conversionRatio || 0) * 1000) / 10, // percentage with 1 decimal
        converted: o.converted || 0,
      })),
    [owners]
  );

  const gendersChart = useMemo(
    () =>
      (genders || []).map((g) => ({
        name: g.gender || "Unknown",
        ratio: Math.round((g.conversionRatio || 0) * 1000) / 10,
        total: g.total || 0,
      })),
    [genders]
  );

  const treatmentsChart = useMemo(
    () =>
      (treatments || []).map((t) => ({
        name: t.name || "Unknown",
        converted: t.converted || 0,
      })),
    [treatments]
  );

  const sourcesChart = useMemo(
    () =>
      (sources || []).map((s) => ({
        name: s.source || "Unknown",
        ratio: Math.round((s.conversionRatio || 0) * 1000) / 10,
        converted: s.converted || 0,
      })),
    [sources]
  );

  const statusesChart = useMemo(
    () =>
      (statuses || []).map((st) => ({
        name: st.status || "Unknown",
        count: st.count || 0,
      })),
    [statuses]
  );

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Conversion by Owner</h3>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ownersChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any, k: any) => (k === "ratio" ? `${Number(v || 0)}%` : v)} />
              <Bar dataKey="ratio" fill="#2D9AA5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Gender Conversion Ratio</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gendersChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any, k: any) => (k === "ratio" ? `${Number(v || 0)}%` : v)} />
              <Bar dataKey="ratio" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Top Treatments Converting Leads</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={treatmentsChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="converted" fill="#0EA5E9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Top Sources Converting Leads</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourcesChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any, k: any) => (k === "ratio" ? `${Number(v || 0)}%` : v)} />
              <Bar dataKey="ratio" fill="#FB923C" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Lead Status Distribution</h3>
        </div>
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusesChart} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
