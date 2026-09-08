"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePieSocket } from "@/lib/usePieSocket";

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
  const [activeTab, setActiveTab] = useState<"ticket" | "preorder">("ticket");
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
        toast.success("Pre-order berhasil disimpan! Dapur akan menyiapkan saat Anda duduk.");
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900 text-red-400 flex items-center justify-center text-2xl font-bold mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Tiket Tidak Ditemukan</h1>
        <p className="text-gray-400 text-sm max-w-sm mb-6">{error ?? "Pastikan nomor tiket antrean sudah benar."}</p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-sm font-bold transition"
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
  const hasPreOrders = customer.pre_orders?.items && customer.pre_orders.items.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center p-4 sm:p-6 pb-20">
      {/* Real-Time Live Status Pill */}
      <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-gray-300 shadow-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`}
        />
        {isConnected ? "Live Real-Time (PieSocket Active)" : "Sinkronisasi Otomatis"}
      </div>

      {/* Navigation Pill (Tiket Antrean vs Pre-Order Makanan) */}
      <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 mb-5 w-full max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab("ticket")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === "ticket"
              ? "bg-primary text-white shadow-md"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Status Antrean
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preorder")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "preorder"
              ? "bg-primary text-white shadow-md"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <span>Pesan Makanan</span>
          {hasPreOrders && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>
      </div>

      {activeTab === "ticket" ? (
        /* Main Digital Ticket Card */
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Top Decorative Header */}
          <div className="text-center pb-5 border-b border-dashed border-slate-700">
            <span className="text-[10px] uppercase tracking-widest font-black text-primary px-2.5 py-1 bg-blue-900 rounded-full border border-blue-700">
              Tiket Antrean Restoran
            </span>
            <h2 className="text-2xl font-black text-white mt-3">{customer.customer_name}</h2>
            <p className="text-xs text-gray-400 mt-1">{customer.party_size} Orang (Party)</p>
          </div>

          {/* Ticket Body / Status Display */}
          <div className="py-6 text-center">
            {isWaiting && (
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                  Nomor Antrean Anda
                </p>
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-blue-900 border-2 border-blue-700 text-primary font-black text-5xl shadow-lg my-2">
                  #{customer.id}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Antrean di Depan</p>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      {ahead_count} <span className="text-xs font-normal text-gray-400">grup</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Estimasi Menunggu</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      ~{estimated_wait_minutes} <span className="text-xs font-normal text-gray-400">mnt</span>
                    </p>
                  </div>
                </div>

                {hasPreOrders && (
                  <div className="mt-4 p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-left">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1">
                      <span>Makanan Telah Dipilih</span>
                      <button
                        onClick={() => setActiveTab("preorder")}
                        className="underline text-[11px]"
                      >
                        Ubah
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      {customer.pre_orders?.items.length} menu siap dimasak begitu Anda duduk di meja.
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                  Mohon tetap berada di area tunggu. Panggilan meja Anda akan otomatis muncul di sini.
                </p>
              </div>
            )}

            {isSeated && (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center mx-auto mb-4 border-2 border-emerald-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-xs text-emerald-400 font-bold tracking-widest uppercase">
                  Meja Anda Telah Siap!
                </p>
                <h3 className="text-3xl font-black text-white mt-2">
                  Meja {customer.table?.id ?? "Siap"}
                </h3>
                <p className="text-sm text-gray-300 mt-2">
                  Silakan menuju meja Anda dan pesanan Anda sedang disiapkan!
                </p>
              </div>
            )}

            {isServed && (
              <div>
                <div className="w-16 h-16 rounded-full bg-blue-900 text-blue-400 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white">Terima Kasih!</h3>
                <p className="text-xs text-gray-400 mt-2">
                  Kunjungan Anda telah selesai. Kami menunggu kedatangan Anda berikutnya.
                </p>
              </div>
            )}
          </div>

          {/* Action to pre-order banner */}
          {isWaiting && !hasPreOrders && (
            <button
              type="button"
              onClick={() => setActiveTab("preorder")}
              className="w-full py-2.5 px-4 mb-4 rounded-xl bg-amber-900 border border-amber-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-800 transition">
              <span>Mau pesan makanan dulu selagi menunggu?</span>
            </button>
          )}

          {/* Ticket Footer / Joined timestamp */}
          <div className="pt-4 border-t border-dashed border-slate-700 flex justify-between items-center text-[11px] text-gray-500">
            <span>Waktu Masuk:</span>
            <span>{new Date(customer.joined_at).toLocaleTimeString()}</span>
          </div>
        </div>
      ) : (
        /* Digital Pre-Order Menu View */
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-2xl">
          <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
            <div>
              <h3 className="font-bold text-base text-white">Menu Pre-Order</h3>
              <p className="text-xs text-gray-400">Pilih makanan agar cepat disajikan di meja</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-blue-900 text-blue-300 font-extrabold rounded-lg">
              {Object.values(cart).reduce((a, b) => a + b, 0)} Item
            </span>
          </div>

          {/* Menu Items List */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {menuList.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-xl text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{item.name}</h4>
                      <p className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                        Rp {item.price.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 text-gray-300 font-bold flex items-center justify-center hover:bg-slate-700"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{qty}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-primary text-white font-bold flex items-center justify-center hover:bg-blue-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes Input */}
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              Catatan Pesanan (opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Tidak pedas, es dipisah..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Total & Submit Button */}
          <div className="mt-4 pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400 font-medium">Estimasi Total:</span>
              <span className="text-base font-black text-emerald-400">
                Rp {calculateTotal().toLocaleString("id-ID")}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSavePreOrder}
              disabled={isSubmittingOrder}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-50 shadow-lg"
            >
              {isSubmittingOrder ? "Menyimpan..." : "Simpan Pilihan Menu Pre-Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
