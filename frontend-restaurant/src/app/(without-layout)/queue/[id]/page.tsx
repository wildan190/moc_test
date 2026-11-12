"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePieSocket } from "@/lib/usePieSocket";
import {
  Card,
  Tabs,
  Tag,
  Typography,
  Space,
  Button,
  Statistic,
  Row,
  Col,
  Input,
  Badge,
  Spin,
  Result,
  Divider,
  Empty,
} from "antd";
import {
  ClockCircleOutlined,
  UsergroupAddOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
  ArrowLeftOutlined,
  InboxOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
}

interface PreOrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

interface TicketData {
  customer: {
    id: number;
    customer_name: string;
    party_size: number;
    status: "waiting" | "seated" | "served" | "cancelled";
    joined_at: string;
    seated_at: string | null;
    completed_at: string | null;
    pre_orders?: {
      items: PreOrderItem[];
      notes?: string;
    } | null;
    table?: {
      id: string;
      capacity: number;
    } | null;
  };
  ahead_count: number;
  estimated_wait_minutes: number;
}

export default function PublicQueueTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-Order State
  const [activeTab, setActiveTab] = useState<string>("ticket");
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";

  const fetchTicket = async () => {
    try {
      const res = await fetch(`${API}/queue/${ticketId}`);
      if (!res.ok) {
        setError("Tiket antrean tidak ditemukan.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTicket(data);
      if (data.customer?.pre_orders?.items) {
        const initialCart: Record<number, number> = {};
        data.customer.pre_orders.items.forEach((it: PreOrderItem) => {
          initialCart[it.id] = it.qty;
        });
        setCart(initialCart);
        if (data.customer.pre_orders.notes) {
          setOrderNotes(data.customer.pre_orders.notes);
        }
      }
      setError(null);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API}/menu`);
      if (res.ok) {
        setMenuList(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchTicket();
    fetchMenu();
    const timer = setInterval(fetchTicket, 10_000);
    return () => clearInterval(timer);
  }, [ticketId]);

  usePieSocket({
    onMessage: (msg) => {
      if (
        msg.event === "table_seated" ||
        msg.event === "table_served" ||
        msg.event === "queue_arrived"
      ) {
        fetchTicket();
      }
    },
  });

  const handleUpdateQty = (itemId: number, delta: number) => {
    setCart((prev) => {
      const cur = prev[itemId] || 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce((sum, [idStr, qty]) => {
      const item = menuList.find((m) => m.id === Number(idStr));
      return sum + (item ? item.price * qty : 0);
    }, 0);
  };

  const handleSavePreOrder = async () => {
    const items: PreOrderItem[] = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([idStr, qty]) => {
        const item = menuList.find((m) => m.id === Number(idStr))!;
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          qty,
        };
      });

    if (items.length === 0) {
      toast.error("Pilih minimal 1 menu untuk pre-order.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API}/queue/${ticketId}/preorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes: orderNotes }),
      });
      if (res.ok) {
        toast.success(
          "Pre-order berhasil disimpan! Dapur akan menyiapkan saat Anda duduk."
        );
        fetchTicket();
        setActiveTab("ticket");
      } else {
        toast.error("Gagal menyimpan pre-order.");
      }
    } catch {
      toast.error("Kesalahan jaringan.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="Memuat status tiket antrean..." />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: 460, margin: "60px auto" }}>
        <Result
          status="404"
          title="Tiket Tidak Ditemukan"
          subTitle={error ?? "Pastikan tautan atau nomor tiket Anda sudah benar."}
          extra={
            <Link href="/">
              <Button type="primary">Kembali ke Beranda</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { customer, ahead_count, estimated_wait_minutes } = ticket;
  const isSeated = customer.status === "seated";
  const isServed = customer.status === "served";
  const isCancelled = customer.status === "cancelled";

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", paddingBottom: 40 }}>
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: "#1677ff" }}>
          PADA Resto
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Status Tiket Antrean Pelanggan
        </Text>
      </div>

      <Card
        variant="borderless"
        style={{
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          borderRadius: 12,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k)}
          centered
          items={[
            {
              key: "ticket",
              label: "Tiket Antrean",
              children: (
                <Space
                  orientation="vertical"
                  size="middle"
                  style={{ width: "100%", marginTop: 8 }}
                >
                  {/* Status Banner */}
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 16px",
                      background: isSeated
                        ? "#f6ffed"
                        : isServed
                        ? "#f0f5ff"
                        : isCancelled
                        ? "#fff1f0"
                        : "#e6f4ff",
                      borderRadius: 10,
                      border: `1px solid ${
                        isSeated
                          ? "#b7eb8f"
                          : isServed
                          ? "#adc6ff"
                          : isCancelled
                          ? "#ffa39e"
                          : "#91caff"
                      }`,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      NOMOR TIKET ANTREAN
                    </Text>
                    <Title level={1} style={{ margin: "4px 0", color: "#1677ff" }}>
                      #{customer.id}
                    </Title>
                    <Title level={4} style={{ margin: "4px 0" }}>
                      {customer.customer_name}
                    </Title>
                    <Tag
                      color={
                        isSeated
                          ? "success"
                          : isServed
                          ? "blue"
                          : isCancelled
                          ? "error"
                          : "processing"
                      }
                      style={{ fontSize: 12, padding: "2px 10px", marginTop: 6 }}
                    >
                      {isSeated
                        ? `Silakan Duduk di Meja ${customer.table?.id}`
                        : isServed
                        ? "Kunjungan Selesai"
                        : isCancelled
                        ? "Dibatalkan"
                        : "Menunggu Giliran Meja"}
                    </Tag>
                  </div>

                  {/* Info Row: Ahead & Estimated Wait */}
                  {!isSeated && !isServed && !isCancelled && (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card size="small" style={{ textAlign: "center" }}>
                          <Statistic
                            title="Antrean di Depan"
                            value={ahead_count}
                            suffix="rombongan"
                            prefix={<UsergroupAddOutlined />}
                            styles={{ content: { fontSize: 20 } }}
                          />
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" style={{ textAlign: "center" }}>
                          <Statistic
                            title="Estimasi Waktu"
                            value={estimated_wait_minutes}
                            suffix="menit"
                            prefix={<ClockCircleOutlined />}
                            styles={{ content: { fontSize: 20, color: "#1677ff" } }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* Pre-Order Banner / CTA */}
                  <Card
                    size="small"
                    style={{
                      background: "#fafafa",
                      border: "1px dashed #d9d9d9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong style={{ fontSize: 13 }}>
                          Pesan Makanan Lebih Awal?
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Menu akan langsung dipersiapkan begitu Anda duduk.
                          </Text>
                        </div>
                      </div>
                      <Button
                        type="primary"
                        icon={<ShoppingOutlined />}
                        onClick={() => setActiveTab("preorder")}
                      >
                        {customer.pre_orders?.items?.length
                          ? "Edit Pre-Order"
                          : "Pilih Menu"}
                      </Button>
                    </div>

                    {customer.pre_orders?.items && (
                      <div style={{ marginTop: 12 }}>
                        <Divider style={{ margin: "8px 0", fontSize: 11 }}>
                          Daftar Pre-Order Tersimpan
                        </Divider>
                        {customer.pre_orders.items.map((it) => (
                          <div
                            key={it.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              padding: "4px 0",
                            }}
                          >
                            <Text>
                              {it.qty}x {it.name}
                            </Text>
                            <Text strong>
                              Rp {(it.price * it.qty).toLocaleString("id-ID")}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Space>
              ),
            },
            {
              key: "preorder",
              label: "Menu & Pre-Order",
              children: (
                <Space
                  orientation="vertical"
                  size="middle"
                  style={{ width: "100%", marginTop: 8 }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Pilih menu makanan & minuman. Pesanan akan dikirim ke dapur
                    secara otomatis saat meja Anda telah siap.
                  </Text>

                  {menuList.length === 0 ? (
                    <Empty description="Katalog menu belum tersedia." />
                  ) : (
                    <div>
                      {menuList.map((item, idx) => {
                        const qty = cart[item.id] || 0;

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: "12px 0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderBottom: idx < menuList.length - 1 ? "1px solid #f0f0f0" : undefined,
                            }}
                          >
                            <div style={{ maxWidth: 280 }}>
                              <Text strong style={{ fontSize: 14 }}>
                                {item.name}
                              </Text>
                              <div>
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                >
                                  {item.description || item.category}
                                </Text>
                              </div>
                              <Text strong style={{ color: "#1677ff" }}>
                                Rp {item.price.toLocaleString("id-ID")}
                              </Text>
                            </div>

                            <Space size="small">
                              {qty > 0 ? (
                                <>
                                  <Button
                                    size="small"
                                    onClick={() => handleUpdateQty(item.id, -1)}
                                  >
                                    -
                                  </Button>
                                  <Text strong style={{ minWidth: 20, textAlign: "center" }}>
                                    {qty}
                                  </Text>
                                  <Button
                                    size="small"
                                    onClick={() => handleUpdateQty(item.id, 1)}
                                  >
                                    +
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="primary"
                                  ghost
                                  size="small"
                                  icon={<ShoppingOutlined />}
                                  onClick={() => handleUpdateQty(item.id, 1)}
                                >
                                  Pesan
                                </Button>
                              )}
                            </Space>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Divider style={{ margin: "12px 0" }} />

                  <div>
                    <Text strong style={{ fontSize: 12 }}>
                      Catatan Khusus ke Dapur
                    </Text>
                    <Input.TextArea
                      placeholder="Contoh: Kurang pedas, es dipisah (opsional)"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      style={{ marginTop: 4 }}
                      rows={2}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Total Pre-Order
                      </Text>
                      <div>
                        <Text strong style={{ fontSize: 18, color: "#1677ff" }}>
                          Rp {calculateTotal().toLocaleString("id-ID")}
                        </Text>
                      </div>
                    </div>

                    <Button
                      type="primary"
                      size="large"
                      loading={isSubmittingOrder}
                      disabled={calculateTotal() === 0}
                      onClick={handleSavePreOrder}
                    >
                      Simpan Pre-Order
                    </Button>
                  </div>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
