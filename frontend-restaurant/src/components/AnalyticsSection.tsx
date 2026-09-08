"use client";

import dynamic from "next/dynamic";
import React, { useMemo } from "react";

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
    const servedMembers = history.filter((h) => h.status === "served" && h.seated_at && h.completed_at);
    
    // Average Wait Time (joined_at -> seated_at) in minutes
    const waitTimes = servedMembers.map((m) => {
      const join = new Date(m.joined_at).getTime();
      const seat = new Date(m.seated_at!).getTime();
      return Math.max(0, (seat - join) / 60_000);
    });
    const avgWaitTime = waitTimes.length
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    // Average Dining Duration in minutes
    const diningTimes = servedMembers.map((m) => {
      const seat = new Date(m.seated_at!).getTime();
      const comp = new Date(m.completed_at!).getTime();
      return Math.max(0, (comp - seat) / 60_000);
    });
    const avgDiningTime = diningTimes.length
      ? Math.round(diningTimes.reduce((a, b) => a + b, 0) / diningTimes.length)
      : 0;

    // Table Utilization %
    const diningCount = tables.filter((t) => t.status === "dining").length;
    const utilizationRate = tables.length ? Math.round((diningCount / tables.length) * 100) : 0;

    return {
      totalServed: servedMembers.length,
      avgWaitTime,
      avgDiningTime,
      utilizationRate,
    };
  }, [history, tables]);

  // 2. Chart: Party Size Breakdown
  const partySizeSeries = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 4: 0, 6: 0 };
    history.forEach((h) => {
      const size = h.party_size <= 1 ? 1 : h.party_size <= 2 ? 2 : h.party_size <= 4 ? 4 : 6;
      counts[size] = (counts[size] || 0) + 1;
    });
    return [counts[1], counts[2], counts[4], counts[6]];
  }, [history]);

  const partySizeOptions: ApexCharts.ApexOptions = {
    chart: { type: "donut" },
    labels: ["Party 1 org", "Party 2 org", "Party 3-4 org", "Party 5-6+ org"],
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"],
    legend: { position: "bottom" },
    dataLabels: { enabled: true },
    stroke: { show: false },
  };

  // 3. Chart: Hourly Arrival Distribution
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => `${i + 10}:00`);
    const counts = new Array(12).fill(0);

    history.forEach((h) => {
      const date = new Date(h.joined_at);
      const hour = date.getHours();
      if (hour >= 10 && hour <= 21) {
        counts[hour - 10] += 1;
      }
    });

    return { hours, counts };
  }, [history]);

  const hourlyChartOptions: ApexCharts.ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3, colors: ["#5750f1"] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100],
      },
    },
    colors: ["#5750f1"],
    xaxis: { categories: hourlyData.hours },
    yaxis: { min: 0, forceNiceScale: true },
    grid: { borderColor: "#f1f5f9" },
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Dilayani</p>
          <p className="text-3xl font-black text-dark dark:text-white mt-2">{metrics.totalServed}</p>
          <p className="text-[11px] text-green-600 font-medium mt-1">Pelanggan selesai</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rata-rata Waktu Tunggu</p>
          <p className="text-3xl font-black text-dark dark:text-white mt-2">{metrics.avgWaitTime} <span className="text-sm font-semibold text-gray-400">menit</span></p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Antre hingga duduk</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rata-rata Durasi Makan</p>
          <p className="text-3xl font-black text-dark dark:text-white mt-2">{metrics.avgDiningTime} <span className="text-sm font-semibold text-gray-400">menit</span></p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Estimasi okupansi meja</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tingkat Utilisasi Meja</p>
          <p className="text-3xl font-black text-primary mt-2">{metrics.utilizationRate}%</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Meja aktif saat ini</p>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-sm text-dark dark:text-white">Tren Kedatangan Pelanggan (Peak Hours)</h3>
              <p className="text-xs text-gray-400">Distribusi jam kedatangan antrean sepanjang hari</p>
            </div>
            <span className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">Hari Ini</span>
          </div>
          <div className="h-64">
            <Chart
              options={hourlyChartOptions}
              series={[{ name: "Pelanggan Datang", data: hourlyData.counts }]}
              type="area"
              height="100%"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-dark dark:text-white">Komposisi Party Size</h3>
            <p className="text-xs text-gray-400 mb-4">Ukuran rombongan pelanggan yang datang</p>
          </div>
          <div className="h-64 flex items-center justify-center">
            {history.length > 0 ? (
              <Chart options={partySizeOptions} series={partySizeSeries} type="donut" width="100%" />
            ) : (
              <p className="text-xs text-gray-400">Belum cukup data riwayat.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
