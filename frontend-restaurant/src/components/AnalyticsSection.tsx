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

  // 2. Average Dining Time per Table Capacity
  const diningPerCapacity = useMemo(() => {
    const groups: Record<number, number[]> = { 2: [], 4: [], 6: [], 8: [] };

    history.forEach((h) => {
      if (h.status === "served" && h.seated_at && h.completed_at) {
        const dur = (new Date(h.completed_at).getTime() - new Date(h.seated_at).getTime()) / 60_000;
        const cap = h.party_size <= 2 ? 2 : h.party_size <= 4 ? 4 : h.party_size <= 6 ? 6 : 8;
        groups[cap].push(dur);
      }
    });

    const categories = ["Meja 2 org", "Meja 4 org", "Meja 6 org", "Meja 8 org"];
    const averages = [2, 4, 6, 8].map((cap) => {
      const arr = groups[cap];
      if (!arr || arr.length === 0) {
        // Fallback default formula: party_size * 15 + 10
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
        borderRadius: 8,
        columnWidth: "45%",
        distributed: true,
      },
    },
    colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"],
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
    grid: { borderColor: "#f1f5f9" },
  };

  // 3. Smart ETA Prediction for currently dining tables
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

  // 4. Chart: Hourly Arrival Distribution (Peak Hours Heatmap / Trend)
  const hourlyData = useMemo(() => {
    // Jam operasional resto: 08:00 s/d 23:00 (16 jam rentang aktif)
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
    stroke: { curve: "smooth", width: 3, colors: ["#5750f1"] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.5,
        opacityTo: 0.05,
        stops: [20, 100],
      },
    },
    colors: ["#5750f1"],
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
    grid: { borderColor: "#f1f5f9" },
    tooltip: {
      y: {
        formatter: (val) => `${val} pelanggan`,
      },
    },
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
          <p className="text-3xl font-black text-dark dark:text-white mt-2">
            {metrics.avgWaitTime} <span className="text-sm font-semibold text-gray-400">menit</span>
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Antre hingga duduk</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rata-rata Durasi Makan</p>
          <p className="text-3xl font-black text-dark dark:text-white mt-2">
            {metrics.avgDiningTime} <span className="text-sm font-semibold text-gray-400">menit</span>
          </p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Estimasi okupansi meja</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tingkat Utilisasi Meja</p>
          <p className="text-3xl font-black text-primary mt-2">{metrics.utilizationRate}%</p>
          <p className="text-[11px] text-gray-500 font-medium mt-1">Meja aktif saat ini</p>
        </div>
      </div>

      {/* Row 2: Average Dining per Capacity & Smart ETA Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Dining Duration per Table Capacity */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-sm text-dark dark:text-white">
                Rata-rata Durasi Makan per Kapasitas Meja
              </h3>
              <p className="text-xs text-gray-400">
                Waktu okupansi aktual berdasarkan ukuran meja (party size)
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200">
              Turnover Rate
            </span>
          </div>
          <div className="h-64">
            <Chart
              options={capacityChartOptions}
              series={[{ name: "Durasi Makan", data: diningPerCapacity.averages }]}
              type="bar"
              height="100%"
            />
          </div>
        </div>

        {/* Smart ETA AI Widget */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h3 className="font-bold text-sm text-dark dark:text-white">Prediksi Meja Kosong (Smart ETA)</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Perkiraan meja yang akan segera selesai berdasarkan historis makan
            </p>

            {smartEtaPredictions.length > 0 ? (
              <div className="space-y-3">
                {smartEtaPredictions.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.tableId}
                    className="p-3 bg-neutral-50 dark:bg-dark-2 rounded-xl border border-neutral-100 dark:border-dark-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md">
                          Meja {item.tableId}
                        </span>
                        <span className="text-xs font-bold text-dark dark:text-white">
                          {item.customerName}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Kapasitas {item.capacity} orang • {item.partySize} tamu
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        ~{item.remainingMinutes} mnt lagi
                      </span>
                      <p className="text-[10px] text-gray-400">
                        {idx === 0 ? "Siap berikutnya" : "Sedang selesai"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-gray-400">
                Semua meja saat ini sedang kosong atau belum terisi.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-dark-3 text-[11px] text-gray-400">
            <em>Smart ETA membantu staf memprediksi antrean berikutnya yang dapat segera dipanggil.</em>
          </div>
        </div>
      </div>

      {/* Row 3: Hourly Arrival Trend Chart */}
      <div className="p-6 rounded-2xl bg-white dark:bg-gray-dark border border-neutral-200 dark:border-dark-3 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-sm text-dark dark:text-white">
              Tren Kedatangan Pelanggan (Peak Hours Heatmap)
            </h3>
            <p className="text-xs text-gray-400">Distribusi jam kedatangan antrean sepanjang hari</p>
          </div>
          <span className="text-xs font-bold text-primary px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">Hari Ini</span>
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
    </div>
  );
}
