"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { playChime, speakQueueCall } from "@/lib/sound";
import { usePieSocket } from "@/lib/usePieSocket";
import AnalyticsSection from "@/components/AnalyticsSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PreOrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

interface TableData {
  id: string;
  capacity: number;
  status: string; // vacant, dining, needs_cleaning, bill_requested, reserved
  queue_member_id: number | null;
  started_at: string | null;
  eating_time_minutes: number | null;
  merged_with?: string | null;
  queue_member?: {
    id: number;
    customer_name: string;
    party_size: number;
    pre_orders?: {
      items: PreOrderItem[];
      notes?: string;
    } | null;
  } | null;
}

interface QueueMember {
  id: number;
  customer_name: string;
  party_size: number;
  status: string;
  joined_at: string;
  seated_at: string | null;
  completed_at: string | null;
  pre_orders?: {
    items: PreOrderItem[];
    notes?: string;
  } | null;
}

// ── Colour scheme per status ──────────────────────────────────────────────────
const PHASE_STYLE: Record<
  string,
  {
    fill: string;
    stroke: string;
    chair: string;
    textColor: string;
    badge: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  vacant: {
    fill: "#d1fae5",
    stroke: "#059669",
    chair: "#6ee7b7",
    textColor: "#064e3b",
    badge: "Vacant",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
  },
  new: {
    fill: "#dbeafe",
    stroke: "#2563eb",
    chair: "#93c5fd",
    textColor: "#1e3a8a",
    badge: "Baru Duduk",
    badgeBg: "#dbeafe",
    badgeText: "#1e40af",
  },
  mid: {
    fill: "#fef9c3",
    stroke: "#d97706",
    chair: "#fcd34d",
    textColor: "#78350f",
    badge: "Sedang Makan",
    badgeBg: "#fef9c3",
    badgeText: "#92400e",
  },
  late: {
    fill: "#fee2e2",
    stroke: "#dc2626",
    chair: "#fca5a5",
    textColor: "#7f1d1d",
    badge: "Hampir Habis",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
  },
  bill_requested: {
    fill: "#fce7f3",
    stroke: "#db2777",
    chair: "#f472b6",
    textColor: "#831843",
    badge: "Minta Tagihan",
    badgeBg: "#fce7f3",
    badgeText: "#9d174d",
  },
  needs_cleaning: {
    fill: "#ffedd5",
    stroke: "#ea580c",
    chair: "#fb923c",
    textColor: "#7c2d12",
    badge: "Perlu Dibersihkan",
    badgeBg: "#ffedd5",
    badgeText: "#c2410c",
  },
  reserved: {
    fill: "#f3e8ff",
    stroke: "#9333ea",
    chair: "#c084fc",
    textColor: "#581c87",
    badge: "Reserved / Digabung",
    badgeBg: "#f3e8ff",
    badgeText: "#6b21a8",
  },
};

function getPhase(table: TableData): string {
  if (table.status === "needs_cleaning") return "needs_cleaning";
  if (table.status === "bill_requested") return "bill_requested";
  if (table.status === "reserved") return "reserved";
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
    6: [
      { x: cx - q, y: T },
      { x: cx + q, y: T },
      { x: L, y: cy },
      { x: R, y: cy },
      { x: cx - q, y: B },
      { x: cx + q, y: B },
    ],
    8: [
      { x: cx - q, y: T },
      { x: cx + q, y: T },
      { x: L, y: cy - hh / 2 },
      { x: L, y: cy + hh / 2 },
      { x: R, y: cy - hh / 2 },
      { x: R, y: cy + hh / 2 },
      { x: cx - q, y: B },
      { x: cx + q, y: B },
    ],
    12: [
      { x: cx - q, y: T },
      { x: cx, y: T },
      { x: cx + q, y: T },
      { x: L, y: cy - hh / 2 },
      { x: L, y: cy + hh / 2 },
      { x: R, y: cy - hh / 2 },
      { x: R, y: cy + hh / 2 },
      { x: cx - q, y: B },
      { x: cx, y: B },
      { x: cx + q, y: B },
    ],
  };
  const key = capacity <= 2 ? 2 : capacity <= 4 ? 4 : capacity <= 6 ? 6 : capacity <= 8 ? 8 : 12;
  return sets[key].slice(0, capacity);
}

// ── SVG birds-eye table visual ────────────────────────────────────────────────
function TableSVG({ capacity, phase }: { capacity: number; phase: string }) {
  const s = PHASE_STYLE[phase] ?? PHASE_STYLE.vacant;
  const cx = 70, cy = 52;
  const hw = capacity <= 2 ? 20 : capacity <= 4 ? 26 : capacity <= 6 ? 32 : capacity <= 8 ? 38 : 46;
  const hh = capacity <= 2 ? 15 : capacity <= 4 ? 20 : capacity <= 6 ? 22 : 25;
  const gap = 5, cr = 7;
  const chairs = chairPositions(capacity, cx, cy, hw, hh, gap, cr);

  return (
    <svg viewBox="0 0 140 104" width={140} height={104} style={{ display: "block", overflow: "visible" }}>
      {chairs.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={cr + 1} ry={cr - 1} fill={s.chair} stroke={s.stroke} strokeWidth={1.5} />
      ))}
      <rect
        x={cx - hw}
        y={cy - hh}
        width={hw * 2}
        height={hh * 2}
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
      if (diff <= 0) {
        setDisplay("Selesai");
        return;
      }
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
        <div
          style={{
            height: "100%",
            width: `${ratio * 100}%`,
            background: barColor,
            borderRadius: 9999,
            transition: "width 1s linear",
          }}
        />
      </div>
    </div>
  );
}

// ── Table Card (floor plan cell) ──────────────────────────────────────────────
function TableCard({
  table,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onForceComplete,
  onUpdateStatus,
  onSplit,
  onDelete,
}: {
  table: TableData;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onForceComplete: () => void;
  onUpdateStatus: (status: string) => void;
  onSplit: () => void;
  onDelete: () => void;
}) {
  const phase = getPhase(table);
  const s = PHASE_STYLE[phase] ?? PHASE_STYLE.vacant;

  const isDining = table.status === "dining" || phase === "new" || phase === "mid" || phase === "late";
  const preOrderItems = table.queue_member?.pre_orders?.items;

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
        minHeight: 310,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
            Meja {table.id}
            {table.merged_with && (
              <span className="ml-1 text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md font-bold">
                + Meja {table.merged_with}
              </span>
            )}
          </span>
          {table.status === "vacant" && !table.merged_with && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Yakin ingin menghapus Meja ${table.id}?`)) {
                  onDelete();
                }
              }}
              className="text-gray-300 hover:text-red-500 transition text-xs p-1"
              title={`Hapus Meja ${table.id}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 9999,
            background: s.badgeBg,
            color: s.badgeText,
            border: `1px solid ${s.stroke}`,
          }}
        >
          {s.badge}
        </span>
      </div>

      {/* Birds-eye SVG */}
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
        <TableSVG capacity={table.capacity} phase={phase} />
      </div>

      {/* Occupant / drop hint */}
      {isDining && table.queue_member ? (
        <div style={{ background: s.fill, border: `1px solid ${s.stroke}`, borderRadius: 10, padding: "8px 10px" }}>
          <div className="flex justify-between items-start">
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: s.textColor, marginBottom: 2 }}>
                {table.queue_member.customer_name}
              </p>
              <p style={{ fontSize: 11, color: s.textColor, opacity: 0.7 }}>
                {table.queue_member.party_size} orang
              </p>
            </div>
            {preOrderItems && preOrderItems.length > 0 && (
              <span
                className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300"
                title={preOrderItems.map((it) => `${it.name} (${it.qty}x)`).join(", ")}
              >
                Pre-Order ({preOrderItems.length})
              </span>
            )}
          </div>

          {table.started_at && table.eating_time_minutes && (
            <Countdown startedAt={table.started_at} minutes={table.eating_time_minutes} />
          )}
        </div>
      ) : table.status === "needs_cleaning" ? (
        <div className="text-center py-2 px-3 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="text-xs font-bold text-orange-800">Perlu Dibersihkan</p>
          <p className="text-[10px] text-orange-600 mt-0.5">Tamu telah selesai makan</p>
        </div>
      ) : table.status === "bill_requested" ? (
        <div className="text-center py-2 px-3 bg-pink-50 border border-pink-200 rounded-xl">
          <p className="text-xs font-bold text-pink-800">Tamu Minta Tagihan</p>
          <p className="text-[10px] text-pink-600 mt-0.5">Siapkan bill pembayaran kasir</p>
        </div>
      ) : table.status === "reserved" ? (
        <div className="text-center py-2 px-3 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-xs font-bold text-purple-800">Reserved / Digabung</p>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: isDragOver ? "#059669" : "#9ca3af",
            fontWeight: isDragOver ? 700 : 400,
            padding: "6px 0",
            flexGrow: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isDragOver ? "Lepaskan di sini" : "Kosong — drop antrean di sini"}
        </div>
      )}

      {/* Granular Table Controls */}
      <div className="mt-auto pt-2 border-t border-neutral-100 dark:border-dark-3 flex flex-col gap-1.5">
        {isDining ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateStatus("bill_requested")}
              className="text-[11px] font-bold py-1.5 px-2 rounded-lg border border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 transition text-center"
            >
              Minta Bill
            </button>
            <button
              type="button"
              onClick={onForceComplete}
              className="text-[11px] font-bold py-1.5 px-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition text-center"
            >
              Selesai Makan
            </button>
          </div>
        ) : table.status === "needs_cleaning" ? (
          <button
            type="button"
            onClick={() => onUpdateStatus("vacant")}
            className="w-full text-xs font-bold py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition text-center shadow-sm"
          >
            Selesai Dibersihkan (Set Vacant)
          </button>
        ) : table.status === "bill_requested" ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateStatus("needs_cleaning")}
              className="text-[11px] font-bold py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition text-center"
            >
              Bayar & Bersihkan
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus("vacant")}
              className="text-[11px] font-bold py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition text-center"
            >
              Set Vacant
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            {table.merged_with ? (
              <button
                type="button"
                onClick={onSplit}
                className="w-full text-xs font-bold py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
              >
                Pisah Meja (Split)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateStatus(table.status === "reserved" ? "vacant" : "reserved")}
                className="w-full text-[11px] font-semibold py-1.5 rounded-lg border border-neutral-200 text-gray-600 hover:bg-neutral-50 transition"
              >
                {table.status === "reserved" ? "Batal Reserve" : "Set Reserved"}
              </button>
            )}
          </div>
        )}
      </div>
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
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [filterPartySize, setFilterPartySize] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: keyof QueueMember; dir: "asc" | "desc" }[]>([
    { key: "completed_at", dir: "desc" },
  ]);

  const [activeTab, setActiveTab] = useState<"floor" | "analytics">("floor");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [ticketModalCustomer, setTicketModalCustomer] = useState<{ id: number; name: string } | null>(null);
  const [mergePrimaryId, setMergePrimaryId] = useState<string>("");
  const [mergeSecondaryId, setMergeSecondaryId] = useState<string>("");

  // Add Table Modal State
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTableId, setNewTableId] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";

  const fetchAll = async () => {
    try {
      const [statusRes, histRes] = await Promise.all([fetch(`${API}/status`), fetch(`${API}/history`)]);
      if (statusRes.ok) {
        const d = await statusRes.json();
        setTables(d.tables ?? []);
        setQueue(d.queue ?? []);
      }
      if (histRes.ok) {
        setHistory((await histRes.json()) ?? []);
      }
    } catch {}
  };

  // PieSocket Real-Time listener
  const { isConnected: isWsConnected } = usePieSocket({
    onMessage: (msg) => {
      fetchAll();
      if (msg.event === "table_seated" && audioEnabled) {
        const customerName = (msg.data.customer_name as string) || "Pelanggan";
        const tableId = (msg.data.table_id as string) || "Meja";
        speakQueueCall(customerName, tableId);
      } else if (msg.event === "queue_arrived" && audioEnabled) {
        playChime();
      }
    },
  });

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 6_000);
    return () => clearInterval(id);
  }, []);

  // Arrive
  const handleArrive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`${API}/arrive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_name: customerName, party_size: partySize }),
        });
        const d = await res.json();
        if (res.ok) {
          toast.success(
            d.customer?.status === "seated"
              ? `${customerName} duduk di Meja ${d.customer?.table?.id}`
              : `${customerName} masuk antrean`
          );
          setCustomerName("");
          fetchAll();
        } else {
          toast.error(d.message ?? "Gagal");
        }
      } catch {
        toast.error("Kesalahan jaringan");
      }
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
      if (res.ok) {
        toast.success(`Meja ${tableId} telah selesai dining. Status diubah ke Needs Cleaning.`);
        fetchAll();
      } else {
        toast.error("Gagal menyelesaikan meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  // Update granular table status
  const handleUpdateStatus = async (tableId: string, status: string) => {
    try {
      const res = await fetch(`${API}/tables/${tableId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Status Meja ${tableId} diperbarui.`);
        fetchAll();
      } else {
        toast.error("Gagal mengubah status meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  // Table merge & split
  const handleMergeTables = async () => {
    if (!mergePrimaryId || !mergeSecondaryId || mergePrimaryId === mergeSecondaryId) {
      toast.error("Pilih 2 meja kosong yang berbeda untuk digabung.");
      return;
    }
    try {
      const res = await fetch(`${API}/tables/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_table_id: mergePrimaryId,
          secondary_table_id: mergeSecondaryId,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        setMergePrimaryId("");
        setMergeSecondaryId("");
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal menggabungkan meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleSplitTable = async (tableId: string) => {
    try {
      const res = await fetch(`${API}/tables/${tableId}/split`, {
        method: "POST",
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal memisahkan meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  // Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableId.trim()) {
      toast.error("Nama / Kode Meja wajib diisi (misal: E, F, VIP1)");
      return;
    }

    setIsCreatingTable(true);
    try {
      const res = await fetch(`${API}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newTableId.trim().toUpperCase(),
          capacity: Number(newTableCapacity),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message ?? `Meja ${newTableId.toUpperCase()} berhasil ditambahkan!`);
        setNewTableId("");
        setNewTableCapacity(4);
        setIsAddTableOpen(false);
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal menambahkan meja baru");
      }
    } catch {
      toast.error("Kesalahan jaringan saat membuat meja");
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Delete Table
  const handleDeleteTable = async (tableId: string) => {
    try {
      const res = await fetch(`${API}/tables/${tableId}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message ?? `Meja ${tableId} berhasil dihapus.`);
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal menghapus meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
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
    if (table.status !== "vacant") {
      toast.error(`Meja ${table.id} tidak berstatus Vacant.`);
      return;
    }
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
      if (res.ok) {
        toast.success(`${member.customer_name} duduk di Meja ${table.id}`);
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal mendudukkan pelanggan");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  // Smart table recommendation calculation
  const getSmartRecommendation = (party: number): string | null => {
    const vacantList = tables.filter((t) => t.status === "vacant" && t.capacity >= party);
    if (!vacantList.length) return null;
    const best = vacantList.sort((a, b) => a.capacity - b.capacity)[0];
    return best?.id ?? null;
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
      const av = a[cfg.key],
        bv = b[cfg.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return cfg.dir === "asc" ? -1 : 1;
      if (av > bv) return cfg.dir === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredHistory = sortedHistory.filter(
    (h) =>
      h.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterPartySize === "all" || h.party_size.toString() === filterPartySize) &&
      (filterStatus === "all" || h.status === filterStatus)
  );

  const filteredTables = tables.filter((t) => {
    if (!tableSearchTerm.trim()) return true;
    const term = tableSearchTerm.toLowerCase();
    return (
      t.id.toLowerCase().includes(term) ||
      (t.queue_member?.customer_name && t.queue_member.customer_name.toLowerCase().includes(term))
    );
  });

  const SortIcon = ({ k }: { k: keyof QueueMember }) => {
    const cfg = sortConfig.find((s) => s.key === k);
    return (
      <span style={{ marginLeft: 4, opacity: cfg ? 1 : 0.3, fontSize: 11 }}>
        {cfg ? (cfg.dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    );
  };

  // Stats
  const vacant = tables.filter((t) => t.status === "vacant").length;
  const dining = tables.filter((t) => t.status === "dining" || t.status === "bill_requested").length;
  const cleaning = tables.filter((t) => t.status === "needs_cleaning").length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-dark dark:text-white">Dashboard Antrean Restoran</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isWsConnected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              {isWsConnected ? "PieSocket Live" : "Polling"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola meja dan antrean pelanggan secara real-time dengan sinkronisasi WebSockets
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Announcer Toggle Button */}
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition ${
              audioEnabled
                ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300"
                : "bg-gray-100 border-gray-200 text-gray-500 dark:bg-dark-2 dark:border-dark-3 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-3"
            }`}
          >
            <span>{audioEnabled ? "Suara: Aktif" : "Suara: Senyap"}</span>
          </button>

          <div className="flex gap-2">
            {[
              { n: vacant, label: "Kosong", bg: "#d1fae5", border: "#6ee7b7", color: "#065f46" },
              { n: dining, label: "Terisi", bg: "#dbeafe", border: "#93c5fd", color: "#1e40af" },
              { n: cleaning, label: "Cleaning", bg: "#ffedd5", border: "#fdba74", color: "#9a3412" },
              { n: queue.length, label: "Antrean", bg: "#ede9fe", border: "#c4b5fd", color: "#4c1d95" },
            ].map(({ n, label, bg, border, color }) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  padding: "6px 14px",
                  borderRadius: 12,
                  background: bg,
                  border: `1px solid ${border}`,
                }}
              >
                <p style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{n}</p>
                <p style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Denah Lantai vs Smart Analytics */}
      <div className="flex border-b border-gray-200 dark:border-dark-3 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("floor")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "floor"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Denah Restoran & Operasional Meja
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === "analytics"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <span>Smart Analytics, AI ETA & Heatmap</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-extrabold uppercase">
            Baru
          </span>
        </button>
      </div>

      {activeTab === "analytics" ? (
        <AnalyticsSection history={history} tables={tables} />
      ) : (
        <>
          {/* Quick Search & Table Merging Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 p-4 rounded-2xl shadow-xs">
            {/* Quick Search Meja / Tamu */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Cari nama tamu aktif / meja..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-neutral-50 text-dark dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-64"
              />
              {tableSearchTerm && (
                <button
                  type="button"
                  onClick={() => setTableSearchTerm("")}
                  className="text-xs text-gray-400 hover:text-dark font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Table Merge Feature */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-semibold text-gray-500">Gabung Meja:</span>
              <select
                value={mergePrimaryId}
                onChange={(e) => setMergePrimaryId(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white"
              >
                <option value="">Pilih Meja 1</option>
                {tables
                  .filter((t) => t.status === "vacant" && !t.merged_with)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Meja {t.id} ({t.capacity} org)
                    </option>
                  ))}
              </select>
              <span>+</span>
              <select
                value={mergeSecondaryId}
                onChange={(e) => setMergeSecondaryId(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-white"
              >
                <option value="">Pilih Meja 2</option>
                {tables
                  .filter((t) => t.status === "vacant" && !t.merged_with && t.id !== mergePrimaryId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Meja {t.id} ({t.capacity} org)
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleMergeTables}
                className="text-xs font-bold py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition"
              >
                Gabung
              </button>
            </div>

            {/* Tambah Meja Button */}
            <button
              type="button"
              onClick={() => setIsAddTableOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Tambah Meja</span>
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            {Object.entries(PHASE_STYLE).map(([key, s]) => (
              <div key={key} className="flex items-center gap-2">
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.stroke }} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{s.badge}</span>
              </div>
            ))}
          </div>

          {/* Floor Plan */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
              Denah Restoran ({filteredTables.length} Meja)
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
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  left: 14,
                  fontSize: 9,
                  color: "#9ca3af",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Lantai Utama
              </span>
              <span
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 14,
                  fontSize: 9,
                  color: "#9ca3af",
                  letterSpacing: "0.05em",
                }}
              >
                Pintu Masuk
              </span>

              {filteredTables.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Tidak ada meja yang sesuai pencarian.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredTables.map((t) => (
                    <TableCard
                      key={t.id}
                      table={t}
                      isDragOver={dragOverId === t.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverId(t.id);
                      }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => handleDrop(e, t)}
                      onForceComplete={() => handleServe(t.id)}
                      onUpdateStatus={(st) => handleUpdateStatus(t.id, st)}
                      onSplit={() => handleSplitTable(t.id)}
                      onDelete={() => handleDeleteTable(t.id)}
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
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} Orang
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold transition text-sm disabled:opacity-50"
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    Prioritas: party terbesar didahulukan & alokasi meja optimal
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-bold">
                  {queue.length} antrean
                </span>
              </div>

              {queue.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto flex-1 pr-1">
                  {queue.map((m, i) => {
                    const recTable = getSmartRecommendation(m.party_size);
                    const preOrderCount = m.pre_orders?.items?.length || 0;

                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, m.id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-neutral-100 dark:border-dark-3 rounded-xl bg-neutral-50 dark:bg-dark select-none gap-2"
                        style={{ cursor: "grab" }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 flex items-center justify-center font-black text-xs shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-dark dark:text-white leading-none">{m.customer_name}</p>
                              {preOrderCount > 0 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                  Pre-Order ({preOrderCount})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(m.joined_at).toLocaleTimeString()} • {m.party_size} orang
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {recTable && (
                            <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-bold px-2 py-0.5 rounded-lg">
                              ⭐ Rekomendasi: Meja {recTable}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTicketModalCustomer({ id: m.id, name: m.customer_name });
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300 font-bold transition flex items-center gap-1"
                            title="Buka Tiket Antrean / QR Code"
                          >
                            <span>Tiket #{m.id}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-10">
                  Tidak ada antrean saat ini.
                </div>
              )}

              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-neutral-100 dark:border-dark-3">
                Drag kartu antrean ke meja kosong pada denah di atas untuk mendudukkan tamu secara manual.
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} Orang
                    </option>
                  ))}
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
                  {(
                    [
                      ["customer_name", "Nama Pelanggan"],
                      ["party_size", "Party Size"],
                      ["status", "Status"],
                      ["joined_at", "Waktu Antre"],
                      ["completed_at", "Waktu Selesai"],
                    ] as [keyof QueueMember, string][]
                  ).map(([key, label]) => (
                    <TableHead
                      key={key}
                      onClick={() => handleSort(key)}
                      className="cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-dark-2 whitespace-nowrap"
                    >
                      {label}
                      <SortIcon k={key} />
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
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            row.status === "served"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(row.joined_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {row.completed_at ? new Date(row.completed_at).toLocaleString() : "—"}
                      </TableCell>
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
        </>
      )}

      {/* QR Ticket Modal Dialog */}
      {ticketModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100 dark:border-dark-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-dark dark:text-white">
                  Tiket Antrean #{ticketModalCustomer.id}
                </h3>
                <p className="text-xs text-gray-400">Atas nama: {ticketModalCustomer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalCustomer(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-dark-2 text-gray-500 hover:text-dark dark:hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-center py-4">
              {/* QR Code Image via free API */}
              <div className="inline-block p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/queue/${ticketModalCustomer.id}`
                      : `http://localhost:3000/queue/${ticketModalCustomer.id}`
                  )}`}
                  alt="QR Code Tiket Antrean"
                  width={180}
                  height={180}
                  className="rounded-lg"
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                Scan QR Code ini menggunakan smartphone untuk memantau status antrean, memesan makanan (pre-order), dan
                melihat estimasi waktu.
              </p>

              <div className="flex gap-2">
                <Link
                  href={`/queue/${ticketModalCustomer.id}`}
                  target="_blank"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-bold text-center transition"
                >
                  Buka Halaman Tiket
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/queue/${ticketModalCustomer.id}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link tiket berhasil disalin!");
                  }}
                  className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-dark-3 text-xs font-bold text-dark dark:text-white hover:bg-neutral-50 dark:hover:bg-dark-2"
                >
                  Salin Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Table Modal ── */}
      {isAddTableOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsAddTableOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-dark dark:text-white mb-1">Tambah Meja Baru</h2>
            <p className="text-xs text-gray-400 mb-5">Isi detail meja yang ingin ditambahkan ke denah restoran.</p>

            <form onSubmit={handleCreateTable} className="space-y-4">
              {/* Kode Meja */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Kode / ID Meja
                </label>
                <input
                  type="text"
                  placeholder="Contoh: E, VIP, F1, Balkon..."
                  value={newTableId}
                  onChange={(e) => setNewTableId(e.target.value.toUpperCase())}
                  maxLength={10}
                  required
                  className="w-full text-sm py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-dark-3 dark:bg-dark bg-neutral-50 text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">Huruf kapital. ID ini akan menjadi pengenal unik meja (misal: Meja E).</p>
              </div>

              {/* Kapasitas */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Kapasitas (orang)
                </label>
                <div className="flex gap-2">
                  {[2, 4, 6, 8, 10].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewTableCapacity(cap)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        newTableCapacity === cap
                          ? "bg-emerald-600 border-emerald-600 text-white shadow"
                          : "border-neutral-200 dark:border-dark-3 text-gray-600 dark:text-gray-300 hover:border-emerald-400"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-neutral-50 dark:bg-dark border border-neutral-200 dark:border-dark-3 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-300 font-extrabold text-sm">
                  {newTableId || "?"}
                </div>
                <div>
                  <p className="text-xs font-bold text-dark dark:text-white">Meja {newTableId || "?"}</p>
                  <p className="text-[11px] text-gray-400">Kapasitas: {newTableCapacity} orang · Status: Kosong</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-dark-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-dark-2 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTable || !newTableId.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
                >
                  {isCreatingTable ? "Menyimpan..." : "Tambah Meja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
