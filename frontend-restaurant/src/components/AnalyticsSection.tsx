"use client";

import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import { Card, Row, Col, Statistic, Typography, Tag, Space } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  PieChartOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

// Dynamic import apexcharts to prevent SSR window reference error
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface QueueMember {
  id: number;
  customer_name: string;
  party_size: number;
  status: string;
  joined_at: string;
  seated_at: string | null;
  completed_at: string | null;
}

interface TableData {
  id: string;
  capacity: number;
  status: string;
  started_at: string | null;
  eating_time_minutes: number | null;
  queue_member?: { id: number; customer_name: string; party_size: number } | null;
}

export default function AnalyticsSection({
  history,
  tables,
}: {
  history: QueueMember[];
  tables: TableData[];
}) {
  // 1. KPI Calculations
  const metrics = useMemo(() => {
    const servedMembers = history.filter(
      (h) => h.status === "served" && h.seated_at && h.completed_at
    );

    const waitTimes = servedMembers.map((m) => {
      const join = new Date(m.joined_at).getTime();
      const seat = new Date(m.seated_at!).getTime();
      return Math.max(0, (seat - join) / 60_000);
    });
    const avgWaitTime = waitTimes.length
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    const diningTimes = servedMembers.map((m) => {
      const seat = new Date(m.seated_at!).getTime();
      const comp = new Date(m.completed_at!).getTime();
      return Math.max(0, (comp - seat) / 60_000);
    });
    const avgDiningTime = diningTimes.length
      ? Math.round(diningTimes.reduce((a, b) => a + b, 0) / diningTimes.length)
      : 0;

    const diningCount = tables.filter((t) => t.status === "dining").length;
    const utilizationRate = tables.length
      ? Math.round((diningCount / tables.length) * 100)
      : 0;

    return {
      totalServed: servedMembers.length,
      avgWaitTime,
      avgDiningTime,
      utilizationRate,
    };
  }, [history, tables]);

  // 2. Average Dining Time per Table Capacity
  const diningPerCapacity = useMemo(() => {
    const groups: Record<number, number[]> = { 2: [], 4: [], 6: [], 8: [] };

    history.forEach((h) => {
      if (h.status === "served" && h.seated_at && h.completed_at) {
        const dur =
          (new Date(h.completed_at).getTime() - new Date(h.seated_at).getTime()) /
          60_000;
        const cap =
          h.party_size <= 2 ? 2 : h.party_size <= 4 ? 4 : h.party_size <= 6 ? 6 : 8;
        groups[cap].push(dur);
      }
    });

    const categories = ["Meja 2 org", "Meja 4 org", "Meja 6 org", "Meja 8 org"];
    const averages = [2, 4, 6, 8].map((cap) => {
      const arr = groups[cap];
      if (!arr || arr.length === 0) {
        return cap * 12 + 5;
      }
      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    });

    return { categories, averages };
  }, [history]);

  const capacityChartOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", toolbar: { show: false } },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "40%",
        distributed: true,
      },
    },
    colors: ["#52c41a", "#1677ff", "#faad14", "#722ed1"],
    legend: { show: false },
    xaxis: { categories: diningPerCapacity.categories },
    yaxis: {
      title: { text: "Durasi Rata-rata (Menit)" },
      forceNiceScale: true,
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val} mnt`,
      style: { fontSize: "11px", fontWeight: "bold" },
    },
    grid: { borderColor: "#f0f0f0" },
  };

  // Perkiraan waktu meja untuk meja yang sedang terisi
  const smartEtaPredictions = useMemo(() => {
    return tables
      .filter((t) => t.status === "dining" && t.started_at)
      .map((t) => {
        const start = new Date(t.started_at!).getTime();
        const duration = (t.eating_time_minutes || 45) * 60_000;
        const remainingMs = start + duration - Date.now();
        const remainingMinutes = Math.max(1, Math.round(remainingMs / 60_000));
        return {
          tableId: t.id,
          capacity: t.capacity,
          customerName: t.queue_member?.customer_name ?? "Tamu",
          partySize: t.queue_member?.party_size ?? t.capacity,
          remainingMinutes,
        };
      })
      .sort((a, b) => a.remainingMinutes - b.remainingMinutes);
  }, [tables]);

  // Tren kedatangan per jam
  const hourlyData = useMemo(() => {
    const startHour = 8;
    const endHour = 23;
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => {
      const h = i + startHour;
      return `${String(h).padStart(2, "0")}:00`;
    });
    const counts = new Array(hours.length).fill(0);

    history.forEach((h) => {
      const date = new Date(h.joined_at);
      const hour = date.getHours();
      if (hour >= startHour && hour <= endHour) {
        counts[hour - startHour] += 1;
      }
    });

    return { hours, counts };
  }, [history]);

  const hourlyChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3, colors: ["#1677ff"] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100],
      },
    },
    colors: ["#1677ff"],
    xaxis: {
      categories: hourlyData.hours,
      labels: {
        rotate: -45,
        rotateAlways: false,
        style: { fontSize: "10px" },
      },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: {
        formatter: (val) => `${Math.round(val)} tamu`,
      },
    },
    grid: { borderColor: "#f0f0f0" },
    tooltip: {
      y: {
        formatter: (val) => `${val} pelanggan`,
      },
    },
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      {/* Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title="Total Tamu Dilayani"
              value={metrics.totalServed}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              suffix="selesai"
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title="Rata-rata Menunggu"
              value={metrics.avgWaitTime}
              prefix={<ClockCircleOutlined style={{ color: "#1677ff" }} />}
              suffix="menit"
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title="Durasi Makan Rata-rata"
              value={metrics.avgDiningTime}
              prefix={<CoffeeOutlined style={{ color: "#faad14" }} />}
              suffix="menit"
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title="Tingkat Utilisasi Meja"
              value={metrics.utilizationRate}
              prefix={<PieChartOutlined style={{ color: "#722ed1" }} />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Row 2: Charts and ETA */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="Rata-rata Durasi Makan per Kapasitas Meja"
            extra={<Tag color="success">Pergantian Meja</Tag>}
            variant="borderless"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <div style={{ height: 280 }}>
              <Chart
                options={capacityChartOptions}
                series={[{ name: "Durasi Makan", data: diningPerCapacity.averages }]}
                type="bar"
                height="100%"
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space orientation="horizontal">
                <FieldTimeOutlined style={{ color: "#1677ff" }} />
                <span>Perkiraan Meja Tersedia</span>
              </Space>
            }
            variant="borderless"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)", height: "100%" }}
          >
            {smartEtaPredictions.length > 0 ? (
              <div>
                {smartEtaPredictions.slice(0, 4).map((item, idx) => (
                  <div
                    key={item.tableId}
                    style={{
                      padding: "10px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: idx < Math.min(smartEtaPredictions.length, 4) - 1 ? "1px solid #f0f0f0" : undefined,
                    }}
                  >
                    <div>
                      <Space orientation="horizontal">
                        <Tag color="blue">{`Meja #${item.tableId}`}</Tag>
                        <Text strong>{`Tamu: ${item.customerName}`}</Text>
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Kapasitas {item.capacity} • {item.partySize} tamu
                        </Text>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text strong style={{ color: "#52c41a" }}>
                        ~{item.remainingMinutes} mnt lagi
                      </Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {idx === 0 ? "Siap berikutnya" : "Sedang selesai"}
                        </Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#8c8c8c" }}>
                Semua meja saat ini sedang kosong atau belum terisi.
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Hourly Arrival Trend Chart */}
      <Card
        title="Tren Kedatangan Pelanggan Hari Ini"
        extra={<Tag color="blue">08:00 - 23:00</Tag>}
        variant="borderless"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div style={{ height: 260 }}>
          <Chart
            options={hourlyChartOptions}
            series={[{ name: "Pelanggan Datang", data: hourlyData.counts }]}
            type="area"
            height="100%"
          />
        </div>
      </Card>
    </Space>
  );
}
