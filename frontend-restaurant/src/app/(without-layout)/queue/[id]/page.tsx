"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePieSocket } from "@/lib/usePieSocket";

interface TicketData {
  customer: {
    id: number;
    customer_name: string;
    party_size: number;
    status: "waiting" | "seated" | "served" | "cancelled";
    joined_at: string;
    seated_at: string | null;
    completed_at: string | null;
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
      setError(null);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    // Fallback polling setiap 10 detik
    const timer = setInterval(fetchTicket, 10_000);
    return () => clearInterval(timer);
  }, [ticketId]);

  // Listen PieSocket Real-Time event
  const { isConnected } = usePieSocket({
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold mb-4">
          ✕
        </div>
        <h1 className="text-xl font-bold mb-2">Tiket Tidak Ditemukan</h1>
        <p className="text-gray-400 text-sm max-w-sm mb-6">{error ?? "Pastikan nomor tiket antrean sudah benar."}</p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const { customer, ahead_count, estimated_wait_minutes } = ticket;
  const isSeated = customer.status === "seated";
  const isServed = customer.status === "served";
  const isWaiting = customer.status === "waiting";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Real-Time Live Status Pill */}
      <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-gray-300 shadow-sm backdrop-blur">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`}
        />
        {isConnected ? "Live Real-Time (PieSocket Active)" : "Sinkronisasi Manual"}
      </div>

      {/* Main Digital Ticket Card */}
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Top Decorative Header */}
        <div className="text-center pb-5 border-b border-dashed border-slate-700">
          <span className="text-[10px] uppercase tracking-widest font-black text-primary px-2.5 py-1 bg-primary/10 rounded-full border border-primary/20">
            Tiket Antrean Restoran
          </span>
          <h2 className="text-2xl font-black text-white mt-3">{customer.customer_name}</h2>
          <p className="text-xs text-gray-400 mt-1">{customer.party_size} Orang (Party)</p>
        </div>

        {/* Ticket Body / Status Display */}
        <div className="py-8 text-center">
          {isWaiting && (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                Nomor Antrean Anda
              </p>
              <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-primary/15 border-2 border-primary/30 text-primary font-black text-5xl shadow-lg my-2">
                #{customer.id}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase">Antrean di Depan</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{ahead_count} <span className="text-xs font-normal text-gray-400">grup</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase">Estimasi Menunggu</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">~{estimated_wait_minutes} <span className="text-xs font-normal text-gray-400">mnt</span></p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Mohon tetap berada di area tunggu. Notifikasi status meja Anda akan diperbarui secara otomatis di halaman ini.
              </p>
            </div>
          )}

          {isSeated && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-4xl mx-auto mb-4 border-2 border-emerald-500/30">
                ✓
              </div>
              <p className="text-xs text-emerald-400 font-bold tracking-widest uppercase">
                Meja Anda Telah Siap!
              </p>
              <h3 className="text-3xl font-black text-white mt-2">
                Meja {customer.table?.id ?? "Siap"}
              </h3>
              <p className="text-sm text-gray-300 mt-2">
                Silakan menuju meja Anda dan selamat menikmati hidangan!
              </p>
            </div>
          )}

          {isServed && (
            <div>
              <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl mx-auto mb-3">
                ★
              </div>
              <h3 className="text-xl font-bold text-white">Terima Kasih!</h3>
              <p className="text-xs text-gray-400 mt-2">
                Kunjungan Anda telah selesai. Kami menunggu kedatangan Anda berikutnya.
              </p>
            </div>
          )}
        </div>

        {/* Ticket Footer / Joined timestamp */}
        <div className="pt-4 border-t border-dashed border-slate-700 flex justify-between items-center text-[11px] text-gray-500">
          <span>Waktu Antre:</span>
          <span>{new Date(customer.joined_at).toLocaleTimeString()}</span>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-6 text-center max-w-xs">
        Halaman ini dapat disimpan atau dibagikan ke anggota rombongan Anda untuk memantau panggilan meja.
      </p>
    </div>
  );
}
