"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { playChime, speakQueueCall } from "@/lib/sound";
import { usePieSocket } from "@/lib/usePieSocket";
import AnalyticsSection from "@/components/AnalyticsSection";

import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Input,
  InputNumber,
  Select,
  Table as AntdTable,
  Modal,
  Space,
  Typography,
  Popconfirm,
  Badge,
  Form,
  Tooltip,
  Divider,
  Empty,
  Tabs,
  Segmented,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  SoundOutlined,
  CheckCircleOutlined,
  CoffeeOutlined,
  UsergroupAddOutlined,
  DeleteOutlined,
  SplitCellsOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  TableOutlined,
  CalendarOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

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
  reservation?: {
    id: number;
    queue_member_id: number | null;
    status: string;
    customer_name: string;
    party_size: number;
    start_time: string;
    end_time: string;
  } | null;
  queue_member?: {
    id: number;
    customer_name: string;
    party_size: number;
    source?: "walk_in" | "reservation";
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
  source?: "walk_in" | "reservation";
  reservation_id?: number | null;
  reservation_table_id?: string | null;
  pre_orders?: {
    items: PreOrderItem[];
    notes?: string;
  } | null;
}

const TABLE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeStatus: "success" | "processing" | "warning" | "default" | "error" }
> = {
  vacant: { label: "Kosong (Vacant)", color: "success", badgeStatus: "success" },
  dining: { label: "Sedang Makan", color: "processing", badgeStatus: "processing" },
  needs_cleaning: { label: "Perlu Dibersihkan", color: "warning", badgeStatus: "warning" },
  bill_requested: { label: "Minta Tagihan", color: "purple", badgeStatus: "processing" },
  reserved: { label: "Reservasi", color: "cyan", badgeStatus: "default" },
};

/**
 * Distribute `capacity` chairs accurately around a rectangular table.
 * Returns exact counts per side — total always equals capacity.
 */
function distributeChairs(capacity: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  if (capacity <= 1) return { top: 0, bottom: 1, left: 0, right: 0 };
  if (capacity === 2) return { top: 1, bottom: 1, left: 0, right: 0 };
  if (capacity === 3) return { top: 1, bottom: 1, left: 0, right: 1 };
  if (capacity === 4) return { top: 1, bottom: 1, left: 1, right: 1 };
  const rem = capacity - 2;
  const top = Math.ceil(rem / 2);
  const bottom = Math.floor(rem / 2);
  return { top, bottom, left: 1, right: 1 };
}

export default function RestaurantDashboard() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [queue, setQueue] = useState<QueueMember[]>([]);
  const [history, setHistory] = useState<QueueMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Form arrive state
  const [customerName, setCustomerName] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [isPending, startTransition] = useTransition();

  // Add Table Modal
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTableId, setNewTableId] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  // Merge Table Modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState("");
  const [mergeSecondaryId, setMergeSecondaryId] = useState("");

  // Pre-order Modal
  const [preOrderModalOpen, setPreOrderModalOpen] = useState(false);
  const [selectedPreOrder, setSelectedPreOrder] = useState<{
    customerName: string;
    items: PreOrderItem[];
    notes?: string;
  } | null>(null);

  // Manual Seat Modal
  const [manualSeatMember, setManualSeatMember] = useState<QueueMember | null>(null);
  const [manualSeatTableId, setManualSeatTableId] = useState<string>("");

  // Reservation Modal (Dashboard direct booking)
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [resForm, setResForm] = useState({
    customer_name: "",
    phone: "",
    party_size: 2,
    reservation_date: new Date().toISOString().slice(0, 10),
    start_time: "18:00",
    end_time: "",
    table_id: "",
    notes: "",
  });
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);

  // Filter States
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [queueSourceFilter, setQueueSourceFilter] = useState("all");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/status`);
      if (res.ok) {
        const d = await res.json();
        setTables(d.tables ?? []);
        setQueue(d.queue ?? []);
      }
    } catch {
      // offline / error
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/history`);
      if (res.ok) {
        const d = await res.json();
        setHistory(Array.isArray(d) ? d : []);
      }
    } catch {
      // offline / error
    }
  };

  const fetchAll = () => {
    fetchStatus();
    fetchHistory();
  };

  usePieSocket({
    onMessage: () => {
      fetchAll();
    },
  });

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 6_000);
    return () => clearInterval(id);
  }, []);

  // Handlers
  const handleArrive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        toast.success(d.message ?? "Meja berhasil digabung");
        setMergePrimaryId("");
        setMergeSecondaryId("");
        setIsMergeModalOpen(false);
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
        toast.success(d.message ?? "Meja berhasil dipisah");
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal memisahkan meja");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleCreateTable = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleManualSeat = async () => {
    if (!manualSeatMember || !manualSeatTableId) return;
    try {
      const res = await fetch(`${API}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queue_member_id: manualSeatMember.id,
          table_id: manualSeatTableId,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`${manualSeatMember.customer_name} duduk di Meja ${manualSeatTableId}`);
        setManualSeatMember(null);
        setManualSeatTableId("");
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal mendudukkan pelanggan");
      }
    } catch {
      toast.error("Kesalahan jaringan");
    }
  };

  // ── Dashboard Reservation handlers ───────────────────────────────────────────
  const handleCreateDashboardReservation = async () => {
    if (!resForm.customer_name.trim()) {
      toast.error("Nama tamu wajib diisi");
      return;
    }
    if (!resForm.table_id) {
      toast.error("Pilih meja terlebih dahulu");
      return;
    }

    // Resolve space_id from selected table_id
    let spaceId: number | null = null;
    try {
      const spaceRes = await fetch(`${API}/pos/spaces?outlet_id=outlet-jakarta`);
      if (spaceRes.ok) {
        const spaces: Array<{ id: number; table_id: string }> = await spaceRes.json();
        const matched = spaces.find((s) => s.table_id === resForm.table_id);
        if (!matched) {
          toast.error(`Meja ${resForm.table_id} belum terdaftar sebagai space reservasi. Hubungi admin.`);
          return;
        }
        spaceId = matched.id;
      }
    } catch {
      toast.error("Gagal mengambil data space reservasi");
      return;
    }

    setIsSubmittingReservation(true);
    try {
      const res = await fetch(`${API}/pos/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: "outlet-jakarta",
          space_id: spaceId,
          customer_name: resForm.customer_name,
          phone: resForm.phone,
          party_size: resForm.party_size,
          reservation_date: resForm.reservation_date,
          start_time: resForm.start_time,
          end_time: resForm.end_time || (() => {
            const [h, m] = resForm.start_time.split(":").map(Number);
            const endH = String(h + 2).padStart(2, "0");
            return `${endH}:${m.toString().padStart(2, "0")}`;
          })(),
          notes: resForm.notes,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Reservasi untuk ${resForm.customer_name} berhasil dibuat!`);
        setResForm({
          customer_name: "",
          phone: "",
          party_size: 2,
          reservation_date: new Date().toISOString().slice(0, 10),
          start_time: "18:00",
          end_time: "",
          table_id: "",
          notes: "",
        });
        setIsReservationModalOpen(false);
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal membuat reservasi");
      }
    } catch {
      toast.error("Kesalahan jaringan saat membuat reservasi");
    } finally {
      setIsSubmittingReservation(false);
    }
  };

  const handleCheckInReservation = async (table: TableData) => {
    if (!table.reservation) return;
    try {
      const res = await fetch(`${API}/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: table.reservation.customer_name,
          party_size: table.reservation.party_size,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(
          d.customer?.status === "seated"
            ? `${table.reservation.customer_name} duduk di Meja ${d.customer?.table?.id}`
            : `${table.reservation.customer_name} masuk antrean`
        );
        fetchAll();
      } else {
        toast.error(d.message ?? "Gagal check-in");
      }
    } catch {
      toast.error("Kesalahan jaringan saat check-in");
    }
  };

  const callCustomer = (member: QueueMember) => {
    playChime();
    const recTable = getSmartRecommendation(member.party_size);
    speakQueueCall(member.customer_name, recTable ?? "kosong");
    toast.success(`Memanggil antrean: ${member.customer_name}`);
  };

  const getSmartRecommendation = (party: number): string | null => {
    const vacantList = tables.filter(
      (t) => t.status === "vacant" && !t.reservation && t.capacity >= party
    );
    if (!vacantList.length) return null;
    const best = vacantList.sort((a, b) => a.capacity - b.capacity)[0];
    return best?.id ?? null;
  };

  // Filtered data
  const filteredTables = tables.filter((t) => {
    if (!tableSearchTerm.trim()) return true;
    const term = tableSearchTerm.toLowerCase();
    return (
      t.id.toLowerCase().includes(term) ||
      (t.queue_member?.customer_name &&
        t.queue_member.customer_name.toLowerCase().includes(term))
    );
  });

  const filteredQueue = queue.filter(
    (member) => queueSourceFilter === "all" || (member.source ?? "walk_in") === queueSourceFilter
  );

  const filteredHistory = history.filter((h) => {
    const matchSearch = h.customer_name
      .toLowerCase()
      .includes(historySearchTerm.toLowerCase());
    const matchStatus =
      historyStatusFilter === "all" || h.status === historyStatusFilter;
    return matchSearch && matchStatus;
  });

  const vacantCount = tables.filter((t) => t.status === "vacant").length;
  const diningCount = tables.filter((t) => t.status === "dining").length;

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      {/* Top Statistic Highlights */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card
            variant="borderless"
            styles={{ body: { padding: "14px 16px" } }}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Statistic
              title={<span style={{ fontSize: 13 }}>Total Meja</span>}
              value={tables.length}
              styles={{ content: { fontSize: 22, fontWeight: 700 } }}
              prefix={<TableOutlined style={{ color: "#1677ff", fontSize: 18 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            variant="borderless"
            styles={{ body: { padding: "14px 16px" } }}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Statistic
              title={<span style={{ fontSize: 13 }}>Meja Kosong</span>}
              value={vacantCount}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: "#52c41a" } }}
              prefix={<CheckCircleOutlined style={{ fontSize: 18 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            variant="borderless"
            styles={{ body: { padding: "14px 16px" } }}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Statistic
              title={<span style={{ fontSize: 13 }}>Sedang Dining</span>}
              value={diningCount}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: "#1677ff" } }}
              prefix={<CoffeeOutlined style={{ fontSize: 18 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            variant="borderless"
            styles={{ body: { padding: "14px 16px" } }}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Statistic
              title={<span style={{ fontSize: 13 }}>Antrean Menunggu</span>}
              value={queue.length}
              styles={{ content: { fontSize: 22, fontWeight: 700, color: "#faad14" } }}
              prefix={<UsergroupAddOutlined style={{ fontSize: 18 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Floor Plan & Queue Panel */}
      <Row gutter={[16, 16]}>
        {/* Floor Plan Cards */}
        <Col xs={24} xl={16}>
          <Card
            variant="borderless"
            styles={{
              header: { padding: "14px 16px", borderBottom: "1px solid #f0f0f0" },
              body: { padding: "16px" },
            }}
            title={
              <Space align="center" size={8}>
                <AppstoreOutlined style={{ color: "#1677ff" }} />
                <span style={{ fontWeight: 600 }}>Denah Meja Restoran</span>
                <Tag color="blue" style={{ margin: 0, borderRadius: 10 }}>
                  {tables.length} Meja
                </Tag>
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={fetchAll} size="small" />
            }
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            {/* Responsive Action Toolbar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Input.Search
                placeholder="Cari meja / tamu..."
                allowClear
                style={{ flex: "1 1 180px", minWidth: 150, maxWidth: 280 }}
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
              />
              <Space wrap size={6}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsAddTableOpen(true)}
                >
                  Tambah Meja
                </Button>
                <Button
                  icon={<SplitCellsOutlined />}
                  onClick={() => setIsMergeModalOpen(true)}
                >
                  Gabung Meja
                </Button>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={() => setIsReservationModalOpen(true)}
                  style={{ borderColor: "#722ed1", color: "#722ed1" }}
                >
                  Reservasi Meja
                </Button>
              </Space>
            </div>

            {filteredTables.length === 0 ? (
              <Empty description="Tidak ada meja yang ditemukan." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
                  gap: 12,
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px dashed #d9d9d9",
                  minHeight: 200,
                }}
              >
                {filteredTables.map((table) => {
                  const statusConf = TABLE_STATUS_CONFIG[table.status] ?? {
                    label: table.status,
                    color: "default",
                    badgeStatus: "default",
                  };
                  const isMerged = !!table.merged_with;

                  // Friendly, clean status palette
                  const tc =
                    table.status === "vacant"
                      ? {
                          cardBorder: "#b7eb8f",
                          topBg: "#f6ffed",
                          tableBg: "#ffffff",
                          tableStroke: "#52c41a",
                          chairSeat: "#b7eb8f",
                          chairBack: "#52c41a",
                          badgeBg: "#f6ffed",
                          badgeText: "#237804",
                          statusColor: "success",
                        }
                      : table.status === "dining"
                      ? {
                          cardBorder: "#91caff",
                          topBg: "#e6f4ff",
                          tableBg: "#ffffff",
                          tableStroke: "#1677ff",
                          chairSeat: "#91caff",
                          chairBack: "#1677ff",
                          badgeBg: "#e6f4ff",
                          badgeText: "#0958d9",
                          statusColor: "processing",
                        }
                      : table.status === "needs_cleaning"
                      ? {
                          cardBorder: "#ffe58f",
                          topBg: "#fffbe6",
                          tableBg: "#ffffff",
                          tableStroke: "#faad14",
                          chairSeat: "#ffe58f",
                          chairBack: "#d48806",
                          badgeBg: "#fffbe6",
                          badgeText: "#ad6800",
                          statusColor: "warning",
                        }
                      : table.status === "bill_requested"
                      ? {
                          cardBorder: "#d3adf7",
                          topBg: "#f9f0ff",
                          tableBg: "#ffffff",
                          tableStroke: "#722ed1",
                          chairSeat: "#d3adf7",
                          chairBack: "#722ed1",
                          badgeBg: "#f9f0ff",
                          badgeText: "#531dab",
                          statusColor: "purple",
                        }
                      : !table.queue_member && table.reservation
                      ? {
                          cardBorder: "#b5a3e0",
                          topBg: "#f5f0ff",
                          tableBg: "#ffffff",
                          tableStroke: "#9254de",
                          chairSeat: "#d3adf7",
                          chairBack: "#9254de",
                          badgeBg: "#f5f0ff",
                          badgeText: "#531dab",
                          statusColor: "purple",
                        }
                      : {
                          cardBorder: "#d9d9d9",
                          topBg: "#f5f5f5",
                          tableBg: "#ffffff",
                          tableStroke: "#bfbfbf",
                          chairSeat: "#d9d9d9",
                          chairBack: "#8c8c8c",
                          badgeBg: "#f5f5f5",
                          badgeText: "#595959",
                          statusColor: "default",
                        };

                  // Exact chair layout based on capacity
                  const ch = distributeChairs(table.capacity);
                  const maxChairsTopBottom = Math.max(ch.top, ch.bottom, 1);
                  const TW = Math.max(54, maxChairsTopBottom * 22 + 28);
                  const TH = 46;
                  const SVG_W = TW + (ch.left > 0 || ch.right > 0 ? 44 : 26);
                  const SVG_H = 88;
                  const TX = (SVG_W - TW) / 2;
                  const TY = (SVG_H - TH) / 2;
                  const GAP = 4;
                  const CW = 14;
                  const CH_H = 8;
                  const CW_S = 8;
                  const CH_S = 14;

                  return (
                    <div
                      key={table.id}
                      style={{
                        background: "white",
                        borderRadius: 12,
                        border: `1.5px solid ${tc.cardBorder}`,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Top Visual: Table with Chairs */}
                      <div
                        style={{
                          background: tc.topBg,
                          padding: "10px 8px 6px",
                          position: "relative",
                          borderBottom: `1px solid ${tc.cardBorder}`,
                        }}
                      >
                        <Popconfirm
                          title="Hapus Meja"
                          description={`Hapus Meja ${table.id}?`}
                          onConfirm={() => handleDeleteTable(table.id)}
                          okText="Hapus"
                          cancelText="Batal"
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              padding: 0,
                              width: 22,
                              height: 22,
                              zIndex: 1,
                            }}
                          />
                        </Popconfirm>

                        <svg
                          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                          style={{ width: "100%", height: 86, display: "block" }}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {/* Top Chairs */}
                          {Array.from({ length: ch.top }).map((_, i) => {
                            const cx = TX + (TW / (ch.top + 1)) * (i + 1);
                            const x = cx - CW / 2;
                            const y = TY - GAP - CH_H;
                            return (
                              <g key={`top-${i}`}>
                                <rect x={x} y={y} width={CW} height={3} rx={1.5} fill={tc.chairBack} />
                                <rect x={x} y={y + 3} width={CW} height={5} rx={2} fill={tc.chairSeat} />
                              </g>
                            );
                          })}

                          {/* Bottom Chairs */}
                          {Array.from({ length: ch.bottom }).map((_, i) => {
                            const cx = TX + (TW / (ch.bottom + 1)) * (i + 1);
                            const x = cx - CW / 2;
                            const y = TY + TH + GAP;
                            return (
                              <g key={`bot-${i}`}>
                                <rect x={x} y={y} width={CW} height={5} rx={2} fill={tc.chairSeat} />
                                <rect x={x} y={y + 5} width={CW} height={3} rx={1.5} fill={tc.chairBack} />
                              </g>
                            );
                          })}

                          {/* Left Chairs */}
                          {Array.from({ length: ch.left }).map((_, i) => {
                            const cy = TY + (TH / (ch.left + 1)) * (i + 1);
                            const x = TX - GAP - CW_S;
                            const y = cy - CH_S / 2;
                            return (
                              <g key={`left-${i}`}>
                                <rect x={x} y={y} width={3} height={CH_S} rx={1.5} fill={tc.chairBack} />
                                <rect x={x + 3} y={y} width={5} height={CH_S} rx={2} fill={tc.chairSeat} />
                              </g>
                            );
                          })}

                          {/* Right Chairs */}
                          {Array.from({ length: ch.right }).map((_, i) => {
                            const cy = TY + (TH / (ch.right + 1)) * (i + 1);
                            const x = TX + TW + GAP;
                            const y = cy - CH_S / 2;
                            return (
                              <g key={`right-${i}`}>
                                <rect x={x} y={y} width={5} height={CH_S} rx={2} fill={tc.chairSeat} />
                                <rect x={x + 5} y={y} width={3} height={CH_S} rx={1.5} fill={tc.chairBack} />
                              </g>
                            );
                          })}

                          {/* Table Surface */}
                          <rect
                            x={TX}
                            y={TY}
                            width={TW}
                            height={TH}
                            rx={8}
                            fill={tc.tableBg}
                            stroke={tc.tableStroke}
                            strokeWidth={2}
                          />

                          {/* Table ID Badge in Center */}
                          <circle
                            cx={TX + TW / 2}
                            cy={TY + TH / 2}
                            r={11}
                            fill={tc.badgeBg}
                            stroke={tc.tableStroke}
                            strokeWidth={1}
                          />
                          <text
                            x={TX + TW / 2}
                            y={TY + TH / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={10}
                            fontWeight="bold"
                            fill={tc.badgeText}
                          >
                            {table.id}
                          </text>

                          {/* Dining plates at seats when dining */}
                          {table.status === "dining" && (
                            <g>
                              {Array.from({ length: ch.top }).map((_, i) => (
                                <circle
                                  key={`tp-${i}`}
                                  cx={TX + (TW / (ch.top + 1)) * (i + 1)}
                                  cy={TY + 7}
                                  r={3}
                                  fill="#f0f5ff"
                                  stroke="#91caff"
                                  strokeWidth={1}
                                />
                              ))}
                              {Array.from({ length: ch.bottom }).map((_, i) => (
                                <circle
                                  key={`bp-${i}`}
                                  cx={TX + (TW / (ch.bottom + 1)) * (i + 1)}
                                  cy={TY + TH - 7}
                                  r={3}
                                  fill="#f0f5ff"
                                  stroke="#91caff"
                                  strokeWidth={1}
                                />
                              ))}
                              {Array.from({ length: ch.left }).map((_, i) => (
                                <circle
                                  key={`lp-${i}`}
                                  cx={TX + 7}
                                  cy={TY + (TH / (ch.left + 1)) * (i + 1)}
                                  r={3}
                                  fill="#f0f5ff"
                                  stroke="#91caff"
                                  strokeWidth={1}
                                />
                              ))}
                              {Array.from({ length: ch.right }).map((_, i) => (
                                <circle
                                  key={`rp-${i}`}
                                  cx={TX + TW - 7}
                                  cy={TY + (TH / (ch.right + 1)) * (i + 1)}
                                  r={3}
                                  fill="#f0f5ff"
                                  stroke="#91caff"
                                  strokeWidth={1}
                                />
                              ))}
                            </g>
                          )}
                        </svg>
                      </div>

                      {/* Bottom Info: Metadata & Operations */}
                      <div
                        style={{
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        {/* Table Name & Status Badge */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Space size={4}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#1f1f1f" }}>
                              {`Meja ${table.id}`}
                            </span>
                            {isMerged && (
                              <Tag color="volcano" style={{ fontSize: 9, margin: 0 }}>
                                +{table.merged_with}
                              </Tag>
                            )}
                          </Space>
                          <Tag color={statusConf.color} style={{ fontSize: 10, margin: 0 }}>
                            {statusConf.label}
                          </Tag>
                        </div>

                        {/* Capacity */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 11,
                            color: "#8c8c8c",
                          }}
                        >
                          <span>Kapasitas</span>
                          <span style={{ fontWeight: 600, color: "#595959" }}>
                            {table.capacity} Kursi
                          </span>
                        </div>

                        {/* Occupant Details */}
                        {table.queue_member ? (
                          <div
                            style={{
                              background: tc.topBg,
                              borderRadius: 6,
                              padding: "6px 8px",
                              marginTop: 2,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: 12, color: "#1f1f1f" }}>
                                {table.queue_member.customer_name}
                              </span>
                              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                                {table.queue_member.party_size} org
                              </Tag>
                            </div>
                            <div style={{ marginTop: 2 }}>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                <span>Sisa waktu</span>: ~{table.eating_time_minutes ?? 45} mnt
                              </Text>
                            </div>
                            {table.queue_member.pre_orders?.items && (
                              <Button
                                type="link"
                                size="small"
                                icon={<ShoppingOutlined />}
                                style={{
                                  padding: 0,
                                  height: "auto",
                                  fontSize: 10,
                                  display: "block",
                                  marginTop: 2,
                                }}
                                onClick={() => {
                                  setSelectedPreOrder({
                                    customerName: table.queue_member!.customer_name,
                                    items: table.queue_member!.pre_orders!.items,
                                    notes: table.queue_member!.pre_orders!.notes,
                                  });
                                  setPreOrderModalOpen(true);
                                }}
                              >
                                Pre-Order ({table.queue_member.pre_orders.items.length})
                              </Button>
                            )}
                          </div>
                        ) : !table.queue_member && table.reservation ? (
                          <div
                            style={{
                              background: "#f9f0ff",
                              borderRadius: 6,
                              padding: "6px 8px",
                              marginTop: 2,
                              border: "1px solid #d3adf7",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Space size={4}>
                                <CalendarOutlined style={{ color: "#722ed1", fontSize: 11 }} />
                                <span style={{ fontWeight: 600, fontSize: 12, color: "#531dab" }}>
                                  {table.reservation.customer_name}
                                </span>
                              </Space>
                              <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>
                                {table.reservation.party_size} org
                              </Tag>
                            </div>
                            <div style={{ marginTop: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                <ClockCircleOutlined style={{ marginRight: 2 }} />
                                {table.reservation.start_time?.slice(0, 5)} – {table.reservation.end_time?.slice(0, 5)}
                              </Text>
                              <Tag color="purple" style={{ fontSize: 9, margin: 0 }}>Reservasi</Tag>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              color: "#8c8c8c",
                              fontSize: 11,
                              fontStyle: "italic",
                              padding: "4px 0",
                            }}
                          >
                            Meja siap digunakan
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div
                          style={{
                            marginTop: "auto",
                            paddingTop: 6,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {!table.queue_member && table.reservation && table.status === "vacant" && (
                            <Button
                              size="small"
                              type="primary"
                              icon={<UserOutlined />}
                              style={{
                                fontSize: 10,
                                background: "#722ed1",
                                borderColor: "#722ed1",
                              }}
                              onClick={() => handleCheckInReservation(table)}
                            >
                              Check-In Tamu
                            </Button>
                          )}
                          {table.status === "dining" && (
                            <Button
                              size="small"
                              type="primary"
                              danger
                              style={{ fontSize: 10 }}
                              onClick={() => handleServe(table.id)}
                            >
                              Force Complete
                            </Button>
                          )}
                          {table.status === "dining" && (
                            <Button
                              size="small"
                              style={{ fontSize: 10 }}
                              onClick={() => handleUpdateStatus(table.id, "bill_requested")}
                            >
                              Minta Tagihan
                            </Button>
                          )}
                          {table.status === "bill_requested" && (
                            <Button
                              size="small"
                              type="primary"
                              danger
                              style={{ fontSize: 10 }}
                              onClick={() => handleServe(table.id)}
                            >
                              Selesai Bayar
                            </Button>
                          )}
                          {table.status === "needs_cleaning" && (
                            <Button
                              size="small"
                              type="primary"
                              style={{
                                background: "#52c41a",
                                borderColor: "#52c41a",
                                fontSize: 10,
                              }}
                              onClick={() => handleUpdateStatus(table.id, "vacant")}
                            >
                              Selesai Dibersihkan
                            </Button>
                          )}
                          {isMerged && (
                            <Button
                              size="small"
                              style={{ fontSize: 10 }}
                              onClick={() => handleSplitTable(table.id)}
                            >
                              Pisahkan Meja
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Waiting Queue & Registration Form */}
        <Col xs={24} xl={8}>
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            {/* Arrive Form Card */}
            <Card
              variant="borderless"
              styles={{
                header: {
                  padding: "16px 20px",
                  borderBottom: "1px solid #f0f0f0",
                },
                body: {
                  padding: "16px 20px",
                },
              }}
              title={
                <Space size={10}>
                  <UsergroupAddOutlined style={{ color: "#1677ff", fontSize: 16 }} />
                  <span style={{ fontWeight: 600, fontSize: 15, color: "#1f1f1f" }}>
                    Registrasi Tamu / Antrean
                  </span>
                </Space>
              }
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <form onSubmit={handleArrive}>
                <Space orientation="vertical" style={{ width: "100%" }} size="middle">
                  <div>
                    <Text strong style={{ fontSize: 12 }}>
                      Nama Tamu / Pelanggan
                    </Text>
                    <Input
                      placeholder="Masukkan nama pelanggan"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{ marginTop: 4 }}
                    />
                  </div>

                  <div>
                    <Text strong style={{ fontSize: 12 }}>
                      Jumlah Tamu (Party Size)
                    </Text>
                    <InputNumber
                      min={1}
                      max={20}
                      value={partySize}
                      onChange={(val) => setPartySize(val || 1)}
                      style={{ width: "100%", marginTop: 4 }}
                    />
                  </div>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={isPending}
                    size="large"
                  >
                    Pelanggan Datang
                  </Button>
                </Space>
              </form>
            </Card>

            {/* Waiting Queue Card */}
            <Card
              variant="borderless"
              styles={{
                header: {
                  padding: "16px 20px",
                  borderBottom: "1px solid #f0f0f0",
                },
                body: {
                  padding: "16px 20px",
                },
              }}
              title={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Space align="center" size={10}>
                    <ClockCircleOutlined style={{ color: "#faad14", fontSize: 16 }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: "#1f1f1f" }}>
                      Antrean Menunggu
                    </span>
                  </Space>
                  <Tag
                    color={queue.length > 0 ? "orange" : "default"}
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      borderRadius: 12,
                      padding: "0 10px",
                      fontSize: 12,
                    }}
                  >
                    {queue.length} Tamu
                  </Tag>
                </div>
              }
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              {/* Filter Sumber Antrean (Segmented Pills) */}
              <div style={{ marginBottom: 16 }}>
                <Segmented
                  block
                  value={queueSourceFilter}
                  onChange={(val) => setQueueSourceFilter(val as string)}
                  options={[
                    {
                      label: `Semua (${queue.length})`,
                      value: "all",
                    },
                    {
                      label: `Walk-In (${queue.filter((m) => (m.source ?? "walk_in") === "walk_in").length})`,
                      value: "walk_in",
                    },
                    {
                      label: `Reservasi (${queue.filter((m) => m.source === "reservation").length})`,
                      value: "reservation",
                    },
                  ]}
                />
              </div>

              {filteredQueue.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: "#8c8c8c", fontSize: 13 }}>
                      {queueSourceFilter === "all"
                        ? "Tidak ada antrean menunggu saat ini."
                        : `Tidak ada antrean ${queueSourceFilter === "walk_in" ? "Walk-In" : "Reservasi"}.`}
                    </span>
                  }
                  style={{ margin: "24px 0" }}
                />
              ) : (
                <Space orientation="vertical" style={{ width: "100%" }} size="small">
                  {filteredQueue.map((member, idx) => {
                    const recTable = getSmartRecommendation(member.party_size);

                    return (
                      <Card
                        key={member.id}
                        size="small"
                        style={{
                          borderRadius: 8,
                          background: "#fafafa",
                          border: "1px solid #f0f0f0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <Space align="center">
                              <Badge
                                count={idx + 1}
                                style={{ backgroundColor: "#1677ff" }}
                              />
                              <span style={{ fontWeight: "bold", fontSize: 14 }}>
                                {member.customer_name}
                              </span>
                              <Tag color="geekblue">{member.party_size} org</Tag>
                              {member.source === "reservation" && (
                                <Tag color="purple">Reservasi</Tag>
                              )}
                            </Space>

                            {recTable && (
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  Saran:{" "}
                                </Text>
                                <Tag color="success">Meja {recTable}</Tag>
                              </div>
                            )}

                            {member.pre_orders?.items && (
                              <Button
                                type="link"
                                size="small"
                                icon={<ShoppingOutlined />}
                                style={{ padding: 0, height: "auto", marginTop: 4 }}
                                onClick={() => {
                                  setSelectedPreOrder({
                                    customerName: member.customer_name,
                                    items: member.pre_orders!.items,
                                    notes: member.pre_orders!.notes,
                                  });
                                  setPreOrderModalOpen(true);
                                }}
                              >
                                Pre-order ({member.pre_orders.items.length})
                              </Button>
                            )}
                          </div>

                          <Space>
                            <Tooltip title="Panggil Antrean Suara">
                              <Button
                                icon={<SoundOutlined />}
                                size="small"
                                onClick={() => callCustomer(member)}
                              />
                            </Tooltip>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => {
                                setManualSeatMember(member);
                                setManualSeatTableId(recTable ?? "");
                              }}
                            >
                              Dudukkan
                            </Button>
                          </Space>
                        </div>
                      </Card>
                    );
                  })}
                </Space>
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      {/* History and Analytics Sections */}
      <Card
        variant="borderless"
        styles={{
          header: { padding: "14px 16px", borderBottom: "1px solid #f0f0f0" },
          body: { padding: "16px" },
        }}
        title={
          <Space align="center" size={8}>
            <ClockCircleOutlined style={{ color: "#1677ff" }} />
            <span style={{ fontWeight: 600 }}>Riwayat Tamu Restoran</span>
          </Space>
        }
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        {/* Responsive History Toolbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Input.Search
            placeholder="Cari nama pelanggan..."
            allowClear
            style={{ flex: "1 1 200px", maxWidth: 300 }}
            value={historySearchTerm}
            onChange={(e) => setHistorySearchTerm(e.target.value)}
          />
          <Select
            value={historyStatusFilter}
            onChange={(val) => setHistoryStatusFilter(val)}
            style={{ width: 140 }}
            options={[
              { label: "Semua Status", value: "all" },
              { label: "Selesai (Served)", value: "served" },
              { label: "Dibatalkan", value: "cancelled" },
            ]}
          />
        </div>

        <AntdTable
          dataSource={filteredHistory}
          rowKey="id"
          pagination={{ pageSize: 8, size: "small" }}
          scroll={{ x: 620 }}
          columns={[
            {
              title: "Nama Pelanggan",
              dataIndex: "customer_name",
              key: "customer_name",
              sorter: (a, b) => a.customer_name.localeCompare(b.customer_name),
              render: (name) => <Text strong>{name}</Text>,
            },
            {
              title: "Jumlah Tamu",
              dataIndex: "party_size",
              key: "party_size",
              render: (size) => `${size} orang`,
            },
            {
              title: "Bergabung",
              dataIndex: "joined_at",
              key: "joined_at",
              render: (dt) =>
                dt
                  ? new Date(dt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
            },
            {
              title: "Duduk",
              dataIndex: "seated_at",
              key: "seated_at",
              render: (dt) =>
                dt
                  ? new Date(dt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
            },
            {
              title: "Selesai",
              dataIndex: "completed_at",
              key: "completed_at",
              render: (dt) =>
                dt
                  ? new Date(dt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (st) => (
                <Tag color={st === "served" ? "success" : "default"}>
                  {st === "served" ? "Selesai" : st}
                </Tag>
              ),
            },
          ]}
        />
      </Card>

      {/* Analytics Section */}
      <AnalyticsSection history={history} tables={tables} />

      {/* Modal: Tambah Meja */}
      <Modal
        title="Tambah Meja Baru"
        open={isAddTableOpen}
        onCancel={() => setIsAddTableOpen(false)}
        footer={null}
        style={{ maxWidth: "calc(100vw - 24px)" }}
      >
        <form onSubmit={handleCreateTable}>
          <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
            <div>
              <Text strong>ID / Nama Meja</Text>
              <Input
                placeholder="Contoh: E, F, VIP1"
                value={newTableId}
                onChange={(e) => setNewTableId(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>Kapasitas Tamu</Text>
              <InputNumber
                min={1}
                max={20}
                value={newTableCapacity}
                onChange={(val) => setNewTableCapacity(val || 2)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button onClick={() => setIsAddTableOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit" loading={isCreatingTable}>
                Simpan Meja
              </Button>
            </div>
          </Space>
        </form>
      </Modal>

      {/* Modal: Gabung Meja */}
      <Modal
        title="Gabung Meja (Table Merge)"
        open={isMergeModalOpen}
        onCancel={() => setIsMergeModalOpen(false)}
        onOk={handleMergeTables}
        okText="Gabungkan"
        cancelText="Batal"
        style={{ maxWidth: "calc(100vw - 24px)" }}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
          <Text type="secondary">
            Pilih dua meja berstatus kosong yang ingin digabung menjadi satu meja kapasitas besar.
          </Text>
          <div>
            <Text strong>Meja Utama (Primary)</Text>
            <Select
              placeholder="Pilih Meja Pertama"
              value={mergePrimaryId || undefined}
              onChange={(val) => setMergePrimaryId(val)}
              style={{ width: "100%", marginTop: 4 }}
              options={tables
                .filter((t) => t.status === "vacant" && !t.merged_with)
                .map((t) => ({ label: `Meja ${t.id} (Kapasitas ${t.capacity})`, value: t.id }))}
            />
          </div>
          <div>
            <Text strong>Meja Kedua (Secondary)</Text>
            <Select
              placeholder="Pilih Meja Kedua"
              value={mergeSecondaryId || undefined}
              onChange={(val) => setMergeSecondaryId(val)}
              style={{ width: "100%", marginTop: 4 }}
              options={tables
                .filter((t) => t.status === "vacant" && !t.merged_with && t.id !== mergePrimaryId)
                .map((t) => ({ label: `Meja ${t.id} (Kapasitas ${t.capacity})`, value: t.id }))}
            />
          </div>
        </Space>
      </Modal>

      {/* Modal: Pre-Order Details */}
      <Modal
        title={`Pre-Order Pesanan: ${selectedPreOrder?.customerName}`}
        open={preOrderModalOpen}
        onCancel={() => setPreOrderModalOpen(false)}
        style={{ maxWidth: "calc(100vw - 24px)" }}
        footer={[
          <Button key="close" type="primary" onClick={() => setPreOrderModalOpen(false)}>
            Tutup
          </Button>,
        ]}
      >
        {selectedPreOrder && (
          <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
            <AntdTable
              dataSource={selectedPreOrder.items}
              rowKey="id"
              pagination={false}
              columns={[
                { title: "Item Menu", dataIndex: "name", key: "name" },
                { title: "Jumlah", dataIndex: "qty", key: "qty", render: (q) => `${q}x` },
                {
                  title: "Harga",
                  dataIndex: "price",
                  key: "price",
                  render: (p) => `Rp ${Number(p).toLocaleString("id-ID")}`,
                },
                {
                  title: "Total",
                  key: "total",
                  render: (_, r) => `Rp ${(r.price * r.qty).toLocaleString("id-ID")}`,
                },
              ]}
            />
            {selectedPreOrder.notes && (
              <Card size="small" title="Catatan Pesanan" style={{ background: "#fafafa" }}>
                <Text>{selectedPreOrder.notes}</Text>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      {/* Modal: Manual Seat Member */}
      <Modal
        title={`Dudukkan Tamu: ${manualSeatMember?.customer_name}`}
        open={!!manualSeatMember}
        onCancel={() => setManualSeatMember(null)}
        onOk={handleManualSeat}
        okText="Konfirmasi Duduk"
        cancelText="Batal"
        style={{ maxWidth: "calc(100vw - 24px)" }}
      >
        {manualSeatMember && (
          <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
            <Text>
              Pilih meja kosong untuk mendudukkan rombongan <strong>{manualSeatMember.customer_name}</strong> (
              {manualSeatMember.party_size} orang):
            </Text>
            <Select
              placeholder="Pilih Meja Tujuan"
              value={manualSeatTableId || undefined}
              onChange={(val) => setManualSeatTableId(val)}
              style={{ width: "100%" }}
              options={tables
                .filter((t) => t.status === "vacant" && t.capacity >= manualSeatMember.party_size)
                .map((t) => ({
                  label: `Meja ${t.id} (Kapasitas ${t.capacity} orang)`,
                  value: t.id,
                }))}
            />
          </Space>
        )}
      </Modal>

      {/* Modal: Buat Reservasi Meja (Dashboard) */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: "#722ed1" }} />
            <span>Buat Reservasi Meja</span>
          </Space>
        }
        open={isReservationModalOpen}
        onCancel={() => setIsReservationModalOpen(false)}
        onOk={handleCreateDashboardReservation}
        okText="Simpan Reservasi"
        cancelText="Batal"
        confirmLoading={isSubmittingReservation}
        width={520}
        style={{ maxWidth: "calc(100vw - 24px)" }}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
          <div>
            <Text strong>Nama Tamu <span style={{ color: "#ff4d4f" }}>*</span></Text>
            <Input
              placeholder="Masukkan nama tamu"
              value={resForm.customer_name}
              onChange={(e) => setResForm((f) => ({ ...f, customer_name: e.target.value }))}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Nomor HP</Text>
            <Input
              placeholder="Contoh: 08123456789"
              value={resForm.phone}
              onChange={(e) => setResForm((f) => ({ ...f, phone: e.target.value }))}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Jumlah Tamu <span style={{ color: "#ff4d4f" }}>*</span></Text>
            <InputNumber
              min={1}
              max={20}
              value={resForm.party_size}
              onChange={(val) => setResForm((f) => ({ ...f, party_size: val || 1, table_id: "" }))}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <Text strong>Pilih Meja <span style={{ color: "#ff4d4f" }}>*</span></Text>
            <Select
              placeholder="Pilih meja yang akan dipesan"
              value={resForm.table_id || undefined}
              onChange={(val) => setResForm((f) => ({ ...f, table_id: val }))}
              style={{ width: "100%", marginTop: 4 }}
              options={tables
                .filter((t) => t.status === "vacant" && t.capacity >= resForm.party_size && !t.reservation)
                .map((t) => ({
                  label: `Meja ${t.id} — kapasitas ${t.capacity} orang`,
                  value: t.id,
                }))}
            />
            {resForm.table_id && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Kapasitas meja: {tables.find((t) => t.id === resForm.table_id)?.capacity ?? "—"} orang
              </Text>
            )}
          </div>
          <Row gutter={8}>
            <Col span={12}>
              <Text strong>Tanggal Reservasi <span style={{ color: "#ff4d4f" }}>*</span></Text>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={resForm.reservation_date}
                onChange={(e) => setResForm((f) => ({ ...f, reservation_date: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            </Col>
            <Col span={12}>
              <Text strong>Jam Mulai <span style={{ color: "#ff4d4f" }}>*</span></Text>
              <Input
                type="time"
                value={resForm.start_time}
                onChange={(e) => setResForm((f) => ({ ...f, start_time: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            </Col>
          </Row>
          <div>
            <Text strong>Catatan (opsional)</Text>
            <Input.TextArea
              placeholder="Contoh: Ulang tahun, alergi makanan, dll."
              value={resForm.notes}
              onChange={(e) => setResForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ marginTop: 4 }}
            />
          </div>
          <div
            style={{
              background: "#f9f0ff",
              borderRadius: 6,
              padding: "8px 12px",
              border: "1px solid #d3adf7",
              fontSize: 12,
              color: "#531dab",
            }}
          >
            <CalendarOutlined style={{ marginRight: 6 }} />
            Reservasi akan otomatis muncul di denah meja pada hari dan jam yang ditentukan.
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
