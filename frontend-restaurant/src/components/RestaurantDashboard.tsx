"use client";

import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TableData {
  id: string;
  capacity: number;
  status: string;
  queue_member_id: number | null;
  started_at: string | null;
  eating_time_minutes: number | null;
  queue_member?: { id: number; customer_name: string; party_size: number } | null;
}

interface QueueMember {
  id: number;
  customer_name: string;
  party_size: number;
  status: string;
  joined_at: string;
  seated_at: string | null;
  completed_at: string | null;
}

// ── Colour scheme per status ──────────────────────────────────────────────────
const PHASE_STYLE = {
  vacant: { fill: "#d1fae5", stroke: "#059669", chair: "#6ee7b7", textColor: "#064e3b", badge: "Vacant",     badgeBg: "#d1fae5", badgeText: "#065f46" },
  new:    { fill: "#dbeafe", stroke: "#2563eb", chair: "#93c5fd", textColor: "#1e3a8a", badge: "Baru Duduk",  badgeBg: "#dbeafe", badgeText: "#1e40af" },
  mid:    { fill: "#fef9c3", stroke: "#d97706", chair: "#fcd34d", textColor: "#78350f", badge: "Sedang Makan",badgeBg: "#fef9c3", badgeText: "#92400e" },
  late:   { fill: "#fee2e2", stroke: "#dc2626", chair: "#fca5a5", textColor: "#7f1d1d", badge: "Hampir Habis",badgeBg: "#fee2e2", badgeText: "#991b1b" },
} as const;
type Phase = keyof typeof PHASE_STYLE;

function getPhase(table: TableData): Phase {
  if (table.status !== "dining" || !table.started_at || !table.eating_time_minutes) return "vacant";
  const ratio = (Date.now() - new Date(table.started_at).getTime()) / (table.eating_time_minutes * 60_000);
  if (ratio < 0.3) return "new";
  if (ratio < 0.8) return "mid";
  return "late";
}

// ── Chair positions by capacity ───────────────────────────────────────────────
function chairPositions(capacity: number, cx: number, cy: number, hw: number, hh: number, gap: number, cr: number) {
  const T = cy - hh - gap - cr;
  const B = cy + hh + gap + cr;
  const L = cx - hw - gap - cr;
  const R = cx + hw + gap + cr;
  const q = hw / 2;

  const sets: Record<number, { x: number; y: number }[]> = {
    2: [{ x: cx, y: T }, { x: cx, y: B }],
    4: [{ x: cx, y: T }, { x: cx, y: B }, { x: L, y: cy }, { x: R, y: cy }],
    6: [{ x: cx - q, y: T }, { x: cx + q, y: T }, { x: L, y: cy }, { x: R, y: cy }, { x: cx - q, y: B }, { x: cx + q, y: B }],
    8: [{ x: cx - q, y: T }, { x: cx + q, y: T }, { x: L, y: cy - hh / 2 }, { x: L, y: cy + hh / 2 }, { x: R, y: cy - hh / 2 }, { x: R, y: cy + hh / 2 }, { x: cx - q, y: B }, { x: cx + q, y: B }],
  };
  const key = capacity <= 2 ? 2 : capacity <= 4 ? 4 : capacity <= 6 ? 6 : 8;
  return sets[key].slice(0, capacity);
}

// ── SVG birds-eye table visual ────────────────────────────────────────────────
function TableSVG({ capacity, phase }: { capacity: number; phase: Phase }) {
  const s = PHASE_STYLE[phase];
  const cx = 70, cy = 52;
  const hw = capacity <= 2 ? 20 : capacity <= 4 ? 26 : capacity <= 6 ? 32 : 38;
  const hh = capacity <= 2 ? 15 : capacity <= 4 ? 20 : capacity <= 6 ? 22 : 25;
  const gap = 5, cr = 7;
  const chairs = chairPositions(capacity, cx, cy, hw, hh, gap, cr);

  return (
    <svg viewBox="0 0 140 104" width={140} height={104} style={{ display: "block", overflow: "visible" }}>
      {chairs.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={cr + 1} ry={cr - 1} fill={s.chair} stroke={s.stroke} strokeWidth={1.5} />
      ))}
      <rect
        x={cx - hw} y={cy - hh}
        width={hw * 2} height={hh * 2}
        rx={6}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={2.5}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill={s.textColor}>
        {capacity} org
      </text>
    </svg>
  );
}

// ── Live Countdown ────────────────────────────────────────────────────────────
function Countdown({ startedAt, minutes }: { startedAt: string; minutes: number }) {
  const [display, setDisplay] = useState("--:--");
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const tick = () => {
      const end = new Date(startedAt).getTime() + minutes * 60_000;
      const diff = end - Date.now();
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const total = minutes * 60_000;
      setRatio(Math.min(Math.max(elapsed / total, 0), 1));
      if (diff <= 0) { setDisplay("Selesai"); return; }
      const m = Math.floor(diff / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [startedAt, minutes]);

  const barColor = ratio < 0.5 ? "#059669" : ratio < 0.8 ? "#d97706" : "#dc2626";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "#6b7280" }}>Sisa waktu</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: barColor }}>{display}</span>
      </div>
      <div style={{ height: 5, background: "#e5e7eb", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${ratio * 100}%`, background: barColor, borderRadius: 9999, transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

// ── Table Card (floor plan cell) ──────────────────────────────────────────────
function TableCard({
  table, isDragOver,
  onDragOver, onDragLeave, onDrop, onForceComplete,
}: {
  table: TableData;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onForceComplete: () => void;
}) {
  const phase = getPhase(table);
  const s = PHASE_STYLE[phase];

  return (
    <div
      data-table-id={table.id}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `2px solid ${isDragOver ? "#10b981" : s.stroke}`,
        borderRadius: 14,
        background: isDragOver ? "#f0fdf4" : "#fff",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: isDragOver
          ? "0 0 0 3px rgba(16,185,129,.25), 0 4px 12px rgba(0,0,0,.1)"
          : "0 1px 4px rgba(0,0,0,.08)",
        transition: "border-color .15s, box-shadow .15s, background .15s",
        minHeight: 280,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>Meja {table.id}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: s.badgeBg, color: s.badgeText, border: `1px solid ${s.stroke}` }}>
          {s.badge}
        </span>
      </div>

      {/* Birds-eye SVG */}
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
        <TableSVG capacity={table.capacity} phase={phase} />
      </div>

      {/* Occupant / drop hint */}
      {table.status === "dining" && table.queue_member ? (
        <div style={{ background: s.fill, border: `1px solid ${s.stroke}`, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: s.textColor, marginBottom: 2 }}>
            {table.queue_member.customer_name}
          </p>
          <p style={{ fontSize: 11, color: s.textColor, opacity: 0.7 }}>
            {table.queue_member.party_size} orang
          </p>
          {table.started_at && table.eating_time_minutes && (
            <Countdown startedAt={table.started_at} minutes={table.eating_time_minutes} />
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 11, color: isDragOver ? "#059669" : "#9ca3af", fontWeight: isDragOver ? 700 : 400, padding: "6px 0", flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isDragOver ? "Lepaskan di sini" : "Kosong — drop antrean di sini"}
        </div>
      )}

      {/* Force Complete */}
      {table.status === "dining" && (
        <button
          onClick={onForceComplete}
          style={{
            marginTop: "auto",
            width: "100%",
            fontSize: 11,
            fontWeight: 700,
            padding: "8px",
            borderRadius: 8,
            border: `1px solid ${s.stroke}`,
            background: s.fill,
            color: s.textColor,
            cursor: "pointer",
          }}
        >
          Force Complete
        </button>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function RestaurantDashboard() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [queue, setQueue] = useState<QueueMember[]>([]);
  const [history, setHistory] = useState<QueueMember[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPartySize, setFilterPartySize] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: keyof QueueMember; dir: "asc" | "desc" }[]>([
    { key: "completed_at", dir: "desc" },
  ]);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";

  const fetchAll = async () => {
    try {
      const [statusRes, histRes] = await Promise.all([
        fetch(`${API}/status`),
        fetch(`${API}/history`),
      ]);
      if (statusRes.ok) {
        const d = await statusRes.json();
        setTables(d.tables ?? []);
        setQueue(d.queue ?? []);
      }
      if (histRes.ok) {
        setHistory(await histRes.json() ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5_000);
    return () => clearInterval(id);
  }, []);

  // Arrive
  const handleArrive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { toast.error("Nama pelanggan wajib diisi"); return; }
    startTransition(async () => {
      try {
        const res = await fetch(`${API}/arrive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_name: customerName, party_size: partySize }),
        });
        const d = await res.json();
        if (res.ok) {
          toast.success(d.customer?.status === "seated" ? `${customerName} duduk di Meja ${d.customer?.table?.id}` : `${customerName} masuk antrean`);
          setCustomerName("");
          fetchAll();
        } else {
          toast.error(d.message ?? "Gagal");
        }
      } catch { toast.error("Kesalahan jaringan"); }
    });
  };

  // Force complete
  const handleServe = async (tableId: string) => {
    try {
      const res = await fetch(`${API}/serve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: tableId }),
      });
      if (res.ok) { toast.success(`Meja ${tableId} dikosongkan`); fetchAll(); }
      else toast.error("Gagal mengosongkan meja");
    } catch { toast.error("Kesalahan jaringan"); }
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, memberId: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("memberId", String(memberId));
  };

  const handleDrop = async (e: React.DragEvent, table: TableData) => {
    e.preventDefault();
    setDragOverId(null);
    const id = parseInt(e.dataTransfer.getData("memberId"), 10);
    const member = queue.find((q) => q.id === id);
    if (!member) return;
    if (table.status === "dining") { toast.error(`Meja ${table.id} sedang terisi`); return; }
    if (member.party_size > table.capacity) {
      toast.error(`Kapasitas Meja ${table.id} (${table.capacity}) tidak cukup untuk ${member.party_size} orang`);
      return;
    }
    try {
      const res = await fetch(`${API}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_member_id: member.id, table_id: table.id }),
      });
      const d = await res.json();
      if (res.ok) { toast.success(`${member.customer_name} duduk di Meja ${table.id}`); fetchAll(); }
      else toast.error(d.message ?? "Gagal mendudukkan pelanggan");
    } catch { toast.error("Kesalahan jaringan"); }
  };

  // Sort
  const handleSort = (key: keyof QueueMember) => {
    setSortConfig((prev) => {
      const ex = prev.find((s) => s.key === key);
      if (ex) return ex.dir === "asc" ? [{ key, dir: "desc" as const }] : prev.filter((s) => s.key !== key);
      return [...prev, { key, dir: "asc" as const }];
    });
  };

  const sortedHistory = [...history].sort((a, b) => {
    for (const cfg of sortConfig) {
      const av = a[cfg.key], bv = b[cfg.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return cfg.dir === "asc" ? -1 : 1;
      if (av > bv) return cfg.dir === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredHistory = sortedHistory.filter((h) =>
    h.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterPartySize === "all" || h.party_size.toString() === filterPartySize) &&
    (filterStatus === "all" || h.status === filterStatus)
  );

  const SortIcon = ({ k }: { k: keyof QueueMember }) => {
    const cfg = sortConfig.find((s) => s.key === k);
    return <span style={{ marginLeft: 4, opacity: cfg ? 1 : 0.3, fontSize: 11 }}>{cfg ? (cfg.dir === "asc" ? "↑" : "↓") : "↕"}</span>;
  };

  // Stats
  const vacant = tables.filter((t) => t.status === "vacant").length;
  const dining = tables.filter((t) => t.status === "dining").length;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-dark dark:text-white">Dashboard Antrean Restoran</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola meja dan antrean pelanggan secara real-time</p>
        </div>
        <div className="flex gap-3">
          {[
            { n: vacant,       label: "Kosong",       bg: "#d1fae5", border: "#6ee7b7", color: "#065f46" },
            { n: dining,       label: "Terisi",        bg: "#dbeafe", border: "#93c5fd", color: "#1e40af" },
            { n: queue.length, label: "Antrean",       bg: "#ede9fe", border: "#c4b5fd", color: "#4c1d95" },
          ].map(({ n, label, bg, border, color }) => (
            <div key={label} style={{ textAlign: "center", padding: "8px 16px", borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
              <p style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{n}</p>
              <p style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {(Object.entries(PHASE_STYLE) as [Phase, typeof PHASE_STYLE[Phase]][]).map(([, s]) => (
          <div key={s.badge} className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.stroke }} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{s.badge}</span>
          </div>
        ))}
      </div>

      {/* Floor Plan */}
      <section>
        <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
          Denah Restoran
        </h2>
        <div
          style={{
            background: "repeating-linear-gradient(45deg,#f9fafb,#f9fafb 10px,#f3f4f6 10px,#f3f4f6 20px)",
            border: "2px dashed #d1d5db",
            borderRadius: 20,
            padding: "28px 20px 20px",
            position: "relative",
          }}
        >
          <span style={{ position: "absolute", top: 8, left: 14, fontSize: 9, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Lantai Utama
          </span>
          <span style={{ position: "absolute", bottom: 8, right: 14, fontSize: 9, color: "#9ca3af", letterSpacing: "0.05em" }}>
            Pintu Masuk ↓
          </span>

          {tables.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Menghubungkan ke backend...</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {tables.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  isDragOver={dragOverId === t.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(t.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => handleDrop(e, t)}
                  onForceComplete={() => handleServe(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Arrival Form + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">Kedatangan Pelanggan</h2>
          <form onSubmit={handleArrive} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Nama Pelanggan</label>
              <input
                type="text"
                placeholder="Masukkan nama..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-sm py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white focus:outline-none focus:ring-2 focus:ring-primary text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Jumlah Party</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full text-sm py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white focus:outline-none focus:ring-2 focus:ring-primary text-dark dark:text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} Orang</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition text-sm disabled:opacity-50"
            >
              {isPending ? "Memproses..." : "Pelanggan Datang"}
            </button>
          </form>
        </div>

        {/* Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Daftar Antrean</h2>
              <p className="text-xs text-gray-400 mt-0.5">Prioritas: party terbesar didahulukan</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-bold">
              {queue.length} antrean
            </span>
          </div>

          {queue.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto flex-1 pr-1">
              {queue.map((m, i) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, m.id)}
                  className="flex justify-between items-center p-3.5 border border-neutral-100 dark:border-dark-3 rounded-xl bg-neutral-50 dark:bg-dark select-none"
                  style={{ cursor: "grab" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-dark dark:text-white leading-none">{m.customer_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(m.joined_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 9999, fontWeight: 700, background: "#ede9fe", color: "#5b21b6" }}>
                    {m.party_size} org
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Tidak ada antrean saat ini.
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-neutral-100 dark:border-dark-3">
            Drag kartu antrean ke meja kosong pada denah di atas untuk mendudukkan secara manual.
          </p>
        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Riwayat Kunjungan</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Cari nama pelanggan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white text-dark dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-44"
            />
            <select
              value={filterPartySize}
              onChange={(e) => setFilterPartySize(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white text-dark dark:text-white focus:outline-none"
            >
              <option value="all">Semua Party Size</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} Orang</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white text-dark dark:text-white focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="served">Served</option>
              <option value="cancelled">Batal</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              {([
                ["customer_name", "Nama Pelanggan"],
                ["party_size",    "Party Size"],
                ["status",        "Status"],
                ["joined_at",     "Waktu Antre"],
                ["completed_at",  "Waktu Selesai"],
              ] as [keyof QueueMember, string][]).map(([key, label]) => (
                <TableHead
                  key={key}
                  onClick={() => handleSort(key)}
                  className="cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-dark-2 whitespace-nowrap"
                >
                  {label}<SortIcon k={key} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHistory.length > 0 ? (
              filteredHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-bold text-dark dark:text-white">{row.customer_name}</TableCell>
                  <TableCell>{row.party_size} orang</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      row.status === "served"
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}>
                      {row.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(row.joined_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{row.completed_at ? new Date(row.completed_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-10">
                  Belum ada riwayat kunjungan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
