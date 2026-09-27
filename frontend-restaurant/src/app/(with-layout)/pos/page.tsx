"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";
const photoHref = (url?: string | null) => !url ? null : url.startsWith("http") ? url : `${API.replace(/\/api\/?$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
const endSlot = (time: string) => { const [hour, minute] = time.split(":").map(Number); const total = hour * 60 + minute + 90; return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; };
type Product = { id: number; name: string; category: string; barcode: string | null; price: number; stock: number; active?: boolean; photo_path?: string | null; photo_url?: string | null; is_bundle: boolean; bundle_items?: string | { product_id: number; quantity: number }[] | null };
type Outlet = { id: string; name: string; address?: string };
type Customer = { id: number; name: string; phone: string; points: number; total_spent: number };
type Sale = { id: number; receipt_number: string; payment_method: string; total: number; discount: number; created_at: string };
type Reservation = { id: number; customer_name: string; phone?: string; party_size: number; reservation_date: string; start_time: string; end_time: string; status: string; space_id: number; space_name: string };
type ReservationSpace = { id: number; name: string; capacity: number };
type CartLine = { product: Product; quantity: number };
type Tab = "Kasir" | "Persediaan" | "Laporan" | "Pelanggan" | "Reservasi";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...(isMultipart ? {} : { "Content-Type": "application/json" }), ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || Object.values(body.errors || {}).flat().join(" ") || "Permintaan gagal.");
  return body as T;
}

export default function PosPage() {
  const [tab, setTab] = useState<Tab>("Kasir");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("outlet-jakarta");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [spaces, setSpaces] = useState<ReservationSpace[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [payment, setPayment] = useState("tunai");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(localDate());
  const [notice, setNotice] = useState("");
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [productForm, setProductForm] = useState({ name: "", barcode: "", category: "Makanan", price: "", stock: "", is_bundle: false, bundle_product_ids: [] as number[] });
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "" });
  const [reservationForm, setReservationForm] = useState({ customer_name: "", phone: "", party_size: "2", reservation_date: localDate(), start_time: "18:00", space_id: "", notes: "" });

  const loadBase = useCallback(async () => {
    try {
      const [outletData, productData, customerData] = await Promise.all([
        api<Outlet[]>("/pos/outlets"), api<Product[]>(`/pos/products?outlet_id=${outletId}`), api<Customer[]>("/pos/customers"),
      ]);
      setOutlets(outletData); setProducts(productData); setCustomers(customerData);
      if (outletData.length && !outletData.some((item) => item.id === outletId)) setOutletId(outletData[0].id);
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Backend POS belum tersambung."); }
  }, [outletId]);

  const loadSales = useCallback(async () => {
    try {
      const data = await api<{ sales: Sale[] }>(`/pos/sales?outlet_id=${outletId}&from=${date}&to=${date}`);
      setSales(data.sales);
    } catch { setSales([]); }
  }, [outletId, date]);

  const loadReservations = useCallback(async () => {
    try {
      const [reservationData, spaceData] = await Promise.all([api<Reservation[]>(`/pos/reservations?outlet_id=${outletId}&date=${reservationForm.reservation_date}`), api<ReservationSpace[]>(`/pos/spaces?outlet_id=${outletId}`)]);
      setReservations(reservationData); setSpaces(spaceData);
      if (spaceData.length && !spaceData.some((space) => String(space.id) === reservationForm.space_id)) setReservationForm((form) => ({ ...form, space_id: String(spaceData[0].id) }));
    }
    catch { setReservations([]); }
  }, [outletId, reservationForm.reservation_date, reservationForm.space_id]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => { void loadSales(); }, [loadSales]);
  useEffect(() => { void loadReservations(); }, [loadReservations]);

  const categories = useMemo(() => ["Semua", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const filtered = useMemo(() => products.filter((p) => p.active !== false && (category === "Semua" || p.category === category) && `${p.name} ${p.barcode || ""}`.toLowerCase().includes(query.toLowerCase())), [products, category, query]);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = Math.max(0, subtotal - Math.min(discount || 0, subtotal));
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const lowStock = products.filter((product) => !product.is_bundle && product.stock <= 10).length;

  const addToCart = (product: Product) => {
    if (!product.is_bundle && product.stock < (cart.find((item) => item.product.id === product.id)?.quantity || 0) + 1) { toast.error("Stok produk tidak mencukupi."); return; }
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      return existing ? items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { product, quantity: 1 }];
    });
  };

  const scan = (value: string) => {
    const product = products.find((item) => item.barcode === value.trim());
    if (product) { addToCart(product); setQuery(""); toast.success(`${product.name} ditambahkan`); }
    else if (value.trim()) toast.error("Barcode tidak ditemukan di outlet ini.");
  };

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const result = await api<{ sale: Sale }>("/pos/checkout", { method: "POST", body: JSON.stringify({ outlet_id: outletId, payment_method: payment, customer_id: customerId ? Number(customerId) : null, discount, items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })) }) });
      toast.success(`Transaksi ${result.sale.receipt_number} berhasil disimpan.`);
      setCart([]); setDiscount(0); setCustomerId("");
      await Promise.all([loadBase(), loadSales()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Transaksi gagal disimpan."); await loadBase(); }
    finally { setBusy(false); }
  };

  const openNewProduct = () => {
    setEditingProductId(null);
    setProductForm({ name: "", barcode: "", category: "Makanan", price: "", stock: "", is_bundle: false, bundle_product_ids: [] });
    setPhotoFile(null); setPhotoPreview(null); setMenuEditorOpen(true);
  };

  const openEditProduct = (product: Product) => {
    const parts = typeof product.bundle_items === "string" ? JSON.parse(product.bundle_items || "[]") : product.bundle_items || [];
    setEditingProductId(product.id);
    setProductForm({ name: product.name, barcode: product.barcode || "", category: product.category, price: String(product.price), stock: String(product.stock), is_bundle: product.is_bundle, bundle_product_ids: parts.map((part: { product_id: number }) => part.product_id) });
    setPhotoFile(null); setPhotoPreview(photoHref(product.photo_url)); setMenuEditorOpen(true);
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const bundle_items = productForm.bundle_product_ids.map((product_id) => ({ product_id, quantity: 1 }));
      if (productForm.is_bundle && !bundle_items.length) { toast.error("Pilih minimal satu produk untuk paket."); return; }
      const body = new FormData();
      body.append("outlet_id", outletId); body.append("name", productForm.name); body.append("barcode", productForm.barcode);
      body.append("category", productForm.category); body.append("price", productForm.price); body.append("stock", productForm.is_bundle ? "0" : productForm.stock);
      body.append("is_bundle", productForm.is_bundle ? "1" : "0");
      bundle_items.forEach((part, index) => { body.append(`bundle_items[${index}][product_id]`, String(part.product_id)); body.append(`bundle_items[${index}][quantity]`, String(part.quantity)); });
      if (photoFile) body.append("photo", photoFile);
      if (editingProductId) body.append("_method", "PATCH");
      await api<Product>(editingProductId ? `/pos/products/${editingProductId}` : "/pos/products", { method: "POST", body });
      setMenuEditorOpen(false); setPhotoFile(null); setPhotoPreview(null); await loadBase(); toast.success(editingProductId ? "Menu berhasil diperbarui." : "Menu baru berhasil ditambahkan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Produk gagal disimpan."); }
  };
  const adjustStock = async (product: Product, amount: number) => {
    try { await api(`/pos/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ stock: Math.max(0, product.stock + amount) }) }); await loadBase(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Stok gagal diperbarui."); }
  };

  const createCustomer = async (event: FormEvent) => {
    event.preventDefault();
    try { await api("/pos/customers", { method: "POST", body: JSON.stringify(customerForm) }); setCustomerForm({ name: "", phone: "" }); await loadBase(); toast.success("Pelanggan berhasil didaftarkan."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Pelanggan gagal disimpan."); }
  };

  const createReservation = async (event: FormEvent) => {
    event.preventDefault();
    const start = reservationForm.start_time;
    const end = endSlot(start);
    try {
      await api("/pos/reservations", { method: "POST", body: JSON.stringify({ ...reservationForm, outlet_id: outletId, space_id: Number(reservationForm.space_id), party_size: Number(reservationForm.party_size), end_time: end }) });
      await loadReservations(); toast.success("Reservasi berhasil dikonfirmasi."); setReservationForm((form) => ({ ...form, customer_name: "", phone: "", notes: "" }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Jadwal sudah terisi atau data tidak valid."); await loadReservations(); }
  };

  const slots = ["11:00", "12:30", "14:00", "17:00", "18:00", "19:00", "20:30"];
  const availableSpaces = spaces.filter((space) => space.capacity >= Number(reservationForm.party_size) && !reservations.some((item) => item.status === "confirmed" && item.space_id === space.id && minutes(reservationForm.start_time) < minutes(item.end_time) && minutes(endSlot(reservationForm.start_time)) > minutes(item.start_time)));

  const cashier = tab === "Kasir";

  return (
    <div className={cashier ? "mx-auto flex h-[calc(100dvh-160px)] min-h-[560px] max-w-[1800px] flex-col gap-3" : "mx-auto max-w-[1500px] space-y-6"}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-primary">PADA / POINT OF SALE</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight text-dark dark:text-white">{cashier ? "Kasir" : tab}</h1></div>
          {cashier && <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex">{sales.length} transaksi hari ini <span className="mx-2 text-emerald-300">·</span>{money(revenue)}</span>}
        </div>
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-medium text-dark-5"><span className="sr-only">Outlet aktif</span><select className="min-w-36 rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white" value={outletId} onChange={(event) => { setOutletId(event.target.value); setCart([]); }} aria-label="Pilih outlet">{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
          {cashier && <button onClick={openNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"><Icon name="plus"/>Tambah menu</button>}
        </div>
      </div>
      {notice && <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><strong>Koneksi POS:</strong> {notice} Jalankan migrasi dan seeder backend.</div>}
      {!cashier && <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4"><Metric title="Penjualan hari ini" value={money(revenue)} detail={`${sales.length} transaksi`} icon="Rp"/><Metric title="Rata-rata transaksi" value={money(sales.length ? Math.round(revenue / sales.length) : 0)} detail="Nilai per struk" icon="AVG"/><Metric title="Produk aktif" value={String(products.length)} detail={`${lowStock} stok menipis`} icon="SKU"/><Metric title="Pelanggan loyal" value={String(customers.length)} detail="Poin otomatis per Rp10.000" icon="LOY"/></div>}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stroke dark:border-stroke-dark">{(["Kasir", "Persediaan", "Laporan", "Pelanggan", "Reservasi"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === item ? "border-primary text-primary" : "border-transparent text-dark-5 hover:text-dark dark:hover:text-white"}`}>{item === "Persediaan" ? "Menu & stok" : item}</button>)}</div>

      {cashier && <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(250px,.85fr)] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_410px] xl:grid-rows-1">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-stroke bg-white shadow-1 dark:border-stroke-dark dark:bg-gray-dark">
          <div className="shrink-0 border-b border-stroke p-3 dark:border-stroke-dark sm:p-4">
            <div className="flex items-center gap-3"><div className="relative min-w-0 flex-1"><input ref={scanRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && scan(query)} placeholder="Cari menu atau pindai barcode" className="w-full rounded-lg border border-stroke bg-gray-1 py-3 pl-10 pr-3.5 text-sm outline-none focus:border-primary dark:border-stroke-dark dark:bg-[#0e1a2b] dark:text-white"/><span className="pointer-events-none absolute left-3 top-3.5 text-dark-5"><Icon name="search"/></span></div><button onClick={openNewProduct} aria-label="Tambah menu" className="grid size-11 shrink-0 place-items-center rounded-lg border border-stroke text-dark-4 hover:border-primary hover:text-primary dark:border-stroke-dark"><Icon name="plus"/></button></div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${category === item ? "bg-dark text-white dark:bg-white dark:text-dark" : "bg-gray-1 text-dark-4 hover:bg-gray-2 dark:bg-[#0e1a2b] dark:text-dark-6"}`}>{item}</button>)}</div>
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-2.5 overflow-y-auto p-3 sm:grid-cols-2 sm:p-4 2xl:grid-cols-3">
            {filtered.map((product) => <button key={product.id} onClick={() => addToCart(product)} disabled={!product.is_bundle && product.stock === 0} className="group flex min-h-[96px] items-center gap-3 rounded-lg border border-stroke p-2.5 text-left transition hover:border-primary hover:bg-primary/[.025] disabled:opacity-50 dark:border-stroke-dark">
              <ProductPhoto product={product} className="size-[76px] shrink-0 rounded-md"/>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-dark dark:text-white">{product.name}</span>{product.is_bundle && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700">Paket</span>}</span><span className="mt-1 block truncate text-[11px] text-dark-5">{product.barcode || product.category} {!product.is_bundle && `· stok ${product.stock}`}</span><span className="mt-1.5 block text-sm font-bold text-primary">{money(product.price)}</span></span>
              <span className="mr-1 grid size-7 shrink-0 place-items-center rounded-full border border-stroke text-dark-4 transition group-hover:border-primary group-hover:bg-primary group-hover:text-white dark:border-stroke-dark"><Icon name="plus"/></span>
            </button>)}
            {!filtered.length && <div className="col-span-full grid min-h-48 place-items-center text-sm text-dark-5">Belum ada menu di outlet ini. Gunakan “Tambah menu” untuk mulai.</div>}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stroke bg-white shadow-1 dark:border-stroke-dark dark:bg-gray-dark">
          <div className="flex shrink-0 items-center justify-between border-b border-stroke px-4 py-3.5 dark:border-stroke-dark"><div><h2 className="text-base font-bold text-dark dark:text-white">Pesanan</h2><p className="text-xs text-dark-5">{cart.reduce((sum, item) => sum + item.quantity, 0)} item dalam transaksi</p></div><button onClick={() => setCart([])} className="text-xs font-semibold text-dark-5 hover:text-red-600">Hapus semua</button></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {cart.map((item) => <div key={item.product.id} className="flex items-center gap-2.5 rounded-lg bg-gray-1 p-2 dark:bg-[#0e1a2b]"><ProductPhoto product={item.product} className="size-12 shrink-0 rounded"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-dark dark:text-white">{item.product.name}</p><p className="mt-1 text-[11px] text-dark-5">{money(item.product.price)} / item</p></div><div className="flex items-center gap-1.5"><button aria-label={`Kurangi ${item.product.name}`} onClick={() => setCart((items) => items.flatMap((line) => line.product.id === item.product.id ? line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : [] : [line]))} className="grid size-7 place-items-center rounded border border-stroke bg-white text-dark-4 dark:border-stroke-dark dark:bg-gray-dark">−</button><span className="w-5 text-center text-xs font-semibold">{item.quantity}</span><button aria-label={`Tambah ${item.product.name}`} onClick={() => addToCart(item.product)} className="grid size-7 place-items-center rounded border border-stroke bg-white text-dark-4 dark:border-stroke-dark dark:bg-gray-dark">+</button></div><span className="w-[76px] text-right text-xs font-semibold text-dark dark:text-white">{money(item.product.price * item.quantity)}</span></div>)}
            {!cart.length && <div className="grid h-full min-h-32 place-items-center text-center text-xs text-dark-5">Pilih menu di sebelah kiri<br/>untuk memulai pesanan.</div>}
          </div>
          <div className="shrink-0 border-t border-stroke p-3 dark:border-stroke-dark sm:p-4">
            <div className="grid grid-cols-[1fr_110px] gap-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-dark-5">Pelanggan<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 w-full rounded-md border border-stroke bg-white px-2.5 py-2 text-xs normal-case dark:border-stroke-dark dark:bg-[#0e1a2b] dark:text-white"><option value="">Pelanggan umum</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.points} pt</option>)}</select></label><label className="text-[10px] font-semibold uppercase tracking-wide text-dark-5">Diskon (Rp)<input type="number" min="0" max={subtotal} value={discount || ""} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value)))} className="mt-1 w-full rounded-md border border-stroke bg-white px-2.5 py-2 text-xs dark:border-stroke-dark dark:bg-[#0e1a2b] dark:text-white" placeholder="0"/></label></div>
            <div className="mt-3 flex items-center justify-between text-xs text-dark-5"><span>Subtotal · diskon {money(Math.min(discount, subtotal))}</span><span>{money(subtotal)}</span></div><div className="mt-1 flex items-center justify-between border-t border-dashed border-stroke pt-2 text-sm font-bold text-dark dark:border-stroke-dark dark:text-white"><span>Total pembayaran</span><span>{money(total)}</span></div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">{[["tunai", "Tunai"], ["qris", "QRIS"], ["kartu", "Kartu"], ["transfer", "Transfer"]].map(([value, label]) => <button key={value} onClick={() => setPayment(value)} className={`rounded-md border py-1.5 text-[10px] font-semibold ${payment === value ? "border-primary bg-primary/10 text-primary" : "border-stroke text-dark-5 dark:border-stroke-dark"}`}>{label}</button>)}</div>
            <button disabled={!cart.length || busy || !!notice} onClick={() => void checkout()} className="mt-2.5 w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Memproses transaksi…" : `Bayar ${money(total)}`}</button>
          </div>
        </aside>
      </div>}

      {tab === "Persediaan" && <section className="overflow-hidden rounded-xl border border-stroke bg-white shadow-1 dark:border-stroke-dark dark:bg-gray-dark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke p-5 dark:border-stroke-dark"><div><h2 className="font-bold text-dark dark:text-white">Menu dan persediaan</h2><p className="mt-1 text-xs text-dark-5">Kelola harga, foto, barcode, paket, dan stok outlet ini.</p></div><button onClick={openNewProduct} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white"><Icon name="plus"/>Tambah menu</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-gray-1 text-[10px] uppercase tracking-wide text-dark-5 dark:bg-[#0e1a2b]"><tr><th className="px-5 py-3">Menu</th><th className="px-4 py-3">Barcode</th><th className="px-4 py-3">Harga</th><th className="px-4 py-3">Stok</th><th className="px-4 py-3">Kelola</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-t border-stroke dark:border-stroke-dark"><td className="px-5 py-3"><div className="flex items-center gap-3"><ProductPhoto product={product} className="size-12 rounded"/><span><span className="block font-semibold text-dark dark:text-white">{product.name}</span><span className="mt-0.5 block text-[11px] text-dark-5">{product.is_bundle ? "Paket" : product.category}</span></span></div></td><td className="px-4 py-3 text-dark-5">{product.barcode || "—"}</td><td className="px-4 py-3 font-medium">{money(product.price)}</td><td className="px-4 py-3">{product.is_bundle ? <span className="text-xs text-dark-5">Bahan</span> : <span className={product.stock <= 10 ? "font-semibold text-amber-600" : ""}>{product.stock}</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => openEditProduct(product)} className="rounded-md border border-stroke px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary dark:border-stroke-dark">Edit</button><button disabled={product.is_bundle} onClick={() => void adjustStock(product, -1)} className="rounded-md border border-stroke px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-stroke-dark">− Stok</button><button disabled={product.is_bundle} onClick={() => void adjustStock(product, 1)} className="rounded-md border border-stroke px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-stroke-dark">+ Stok</button></div></td></tr>)}</tbody></table>{!products.length && <div className="p-12 text-center text-sm text-dark-5">Belum ada menu. Gunakan tombol Tambah menu untuk membuat menu pertama.</div>}</div>
      </section>}

      {tab === "Laporan" && <section className="rounded-2xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-dark dark:text-white">Laporan penjualan</h2><p className="text-sm text-dark-5">Performa transaksi outlet yang dipilih.</p></div><label className="text-sm text-dark-5">Tanggal<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`}/></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric title="Omzet bersih" value={money(revenue)} detail={date} icon="↗"/><Metric title="Transaksi" value={String(sales.length)} detail="Struk tersimpan" icon="▤"/><Metric title="Diskon diberikan" value={money(sales.reduce((sum, sale) => sum + Number(sale.discount), 0))} detail="Total diskon" icon="%"/></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-gray-1 text-xs uppercase text-dark-5 dark:bg-[#0e1a2b]"><tr><th className="px-4 py-3">Struk</th><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Pembayaran</th><th className="px-4 py-3">Diskon</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id} className="border-t border-stroke dark:border-stroke-dark"><td className="px-4 py-3 font-semibold">{sale.receipt_number}</td><td className="px-4 py-3 text-dark-5">{new Date(sale.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td><td className="px-4 py-3 capitalize">{sale.payment_method}</td><td className="px-4 py-3">{money(sale.discount)}</td><td className="px-4 py-3 text-right font-bold">{money(sale.total)}</td></tr>)}</tbody></table>{!sales.length && <div className="p-10 text-center text-sm text-dark-5">Belum ada transaksi untuk tanggal ini.</div>}</div></section>}

      {tab === "Pelanggan" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-hidden rounded-2xl border border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark"><div className="border-b border-stroke p-5 dark:border-stroke-dark"><h2 className="font-bold text-dark dark:text-white">Program pelanggan</h2><p className="text-xs text-dark-5">1 poin diperoleh setiap belanja Rp10.000.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-gray-1 text-xs uppercase text-dark-5 dark:bg-[#0e1a2b]"><tr><th className="px-5 py-3">Nama</th><th className="px-4 py-3">Nomor telepon</th><th className="px-4 py-3">Poin</th><th className="px-4 py-3">Total belanja</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="border-t border-stroke dark:border-stroke-dark"><td className="px-5 py-4 font-semibold text-dark dark:text-white">{customer.name}</td><td className="px-4 py-4">{customer.phone}</td><td className="px-4 py-4"><span className="rounded-full bg-violet-100 px-2.5 py-1 font-bold text-violet-700">{customer.points} poin</span></td><td className="px-4 py-4">{money(customer.total_spent)}</td></tr>)}</tbody></table>{!customers.length && <div className="p-10 text-center text-sm text-dark-5">Belum ada pelanggan loyal.</div>}</div></section><form onSubmit={createCustomer} className="h-fit rounded-2xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark"><h2 className="font-bold text-dark dark:text-white">Daftarkan pelanggan</h2><p className="mb-4 mt-1 text-xs text-dark-5">Nomor telepon menjadi identitas unik.</p><Field label="Nama lengkap"><input required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} className={inputClass} placeholder="Nama pelanggan"/></Field><Field label="Nomor telepon"><input required value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className={inputClass} placeholder="08…"/></Field><button className="mt-2 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white">Simpan pelanggan</button></form></div>}

      {tab === "Reservasi" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]"><section className="overflow-hidden rounded-2xl border border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke p-5 dark:border-stroke-dark"><div><h2 className="font-bold text-dark dark:text-white">Jadwal reservasi</h2><p className="text-xs text-dark-5">Durasi meja 90 menit. Ketersediaan dihitung per meja dan kapasitas.</p></div><input type="date" value={reservationForm.reservation_date} onChange={(e) => setReservationForm({ ...reservationForm, reservation_date: e.target.value })} className={inputClass}/></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{reservations.map((reservation) => <div key={reservation.id} className="rounded-xl border border-stroke p-4 dark:border-stroke-dark"><div className="flex items-center justify-between"><span className="font-bold text-dark dark:text-white">{reservation.start_time.slice(0, 5)}–{reservation.end_time.slice(0, 5)}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">Dikonfirmasi</span></div><p className="mt-3 font-semibold">{reservation.customer_name}</p><p className="mt-1 text-xs text-dark-5">{reservation.space_name} · {reservation.party_size} orang · {reservation.phone || "Tanpa telepon"}</p></div>)}{!reservations.length && <div className="col-span-full rounded-xl bg-gray-1 p-10 text-center text-sm text-dark-5 dark:bg-[#0e1a2b]">Belum ada reservasi pada tanggal ini.</div>}</div></section><form onSubmit={createReservation} className="h-fit rounded-2xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark"><h2 className="font-bold text-dark dark:text-white">Buat reservasi</h2><p className="mb-4 mt-1 text-xs text-dark-5">Pilih meja sesuai kapasitas. Bentrok diperiksa ulang saat penyimpanan.</p><Field label="Nama pemesan"><input required value={reservationForm.customer_name} onChange={(e) => setReservationForm({ ...reservationForm, customer_name: e.target.value })} className={inputClass}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Telepon"><input value={reservationForm.phone} onChange={(e) => setReservationForm({ ...reservationForm, phone: e.target.value })} className={inputClass}/></Field><Field label="Jumlah orang"><input type="number" min="1" max="40" required value={reservationForm.party_size} onChange={(e) => setReservationForm({ ...reservationForm, party_size: e.target.value })} className={inputClass}/></Field></div><Field label="Pilih jam tersedia"><select value={reservationForm.start_time} onChange={(e) => setReservationForm({ ...reservationForm, start_time: e.target.value })} className={inputClass}>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></Field><Field label="Meja tersedia"><select required value={reservationForm.space_id} onChange={(e) => setReservationForm({ ...reservationForm, space_id: e.target.value })} className={inputClass}>{availableSpaces.map((space) => <option key={space.id} value={space.id}>{space.name} · hingga {space.capacity} orang</option>)}</select></Field><Field label="Catatan"><textarea value={reservationForm.notes} onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })} className={`${inputClass} min-h-20`} placeholder="Permintaan khusus (opsional)"/></Field><button disabled={!availableSpaces.length} className="mt-2 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white disabled:opacity-50">{availableSpaces.length ? "Konfirmasi reservasi" : "Tidak ada meja tersedia"}</button></form></div>}

      {menuEditorOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/45 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuEditorOpen(false); }}>
        <form onSubmit={saveProduct} className="flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-4 dark:bg-gray-dark">
          <div className="flex shrink-0 items-start justify-between border-b border-stroke px-5 py-4 dark:border-stroke-dark sm:px-7"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">MENU / KATALOG</p><h2 className="mt-1 text-xl font-bold text-dark dark:text-white">{editingProductId ? "Edit menu" : "Tambah menu"}</h2><p className="mt-1 text-xs text-dark-5">Detail menu langsung tersedia untuk outlet {outlets.find((outlet) => outlet.id === outletId)?.name || "ini"}.</p></div><button type="button" onClick={() => setMenuEditorOpen(false)} aria-label="Tutup" className="grid size-9 place-items-center rounded-lg border border-stroke text-dark-5 hover:text-dark dark:border-stroke-dark dark:hover:text-white"><Icon name="close"/></button></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"><div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div><div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-stroke bg-gray-1 dark:border-stroke-dark dark:bg-[#0e1a2b]">{photoPreview ? <img src={photoPreview} alt="Pratinjau foto menu" className="size-full object-cover"/> : <div className="flex size-full flex-col items-center justify-center gap-2 text-dark-5"><Icon name="image"/><span className="text-xs">Foto menu</span></div>}</div><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stroke px-3 py-2.5 text-xs font-semibold text-dark-4 hover:border-primary hover:text-primary dark:border-stroke-dark"><Icon name="upload"/>Pilih foto<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] || null; setPhotoFile(file); setPhotoPreview(file ? URL.createObjectURL(file) : null); }}/></label><p className="mt-1 text-center text-[10px] text-dark-5">JPG, PNG atau WebP · maks. 4 MB</p></div>
            <div><Field label="Nama menu"><input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={inputClass} placeholder="Contoh: Kopi susu gula aren"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Kategori"><select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className={inputClass}><option>Makanan</option><option>Minuman</option><option>Snack</option><option>Paket</option><option>Lainnya</option></select></Field><Field label="Harga (Rp)"><input type="number" required min="0" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} className={inputClass} placeholder="0"/></Field></div><Field label="Barcode"><input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} className={inputClass} placeholder="Pindai atau masukkan barcode"/></Field><label className="mb-3 flex items-center gap-2 text-sm font-medium text-dark-4"><input type="checkbox" checked={productForm.is_bundle} onChange={(e) => setProductForm({ ...productForm, is_bundle: e.target.checked, category: e.target.checked ? "Paket" : "Makanan" })}/>Menu paket / bundle</label>{productForm.is_bundle ? <Field label="Komposisi paket"><select multiple value={productForm.bundle_product_ids.map(String)} onChange={(e) => setProductForm({ ...productForm, bundle_product_ids: Array.from(e.target.selectedOptions, (option) => Number(option.value)) })} className={`${inputClass} min-h-24`}>{products.filter((product) => !product.is_bundle && product.id !== editingProductId).map((product) => <option key={product.id} value={product.id}>{product.name} · stok {product.stock}</option>)}</select></Field> : <Field label={editingProductId ? "Stok saat ini" : "Stok awal"}><input type="number" required min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} className={inputClass}/></Field>}</div>
          </div></div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-stroke px-5 py-4 dark:border-stroke-dark sm:px-7"><button type="button" onClick={() => setMenuEditorOpen(false)} className="rounded-lg border border-stroke px-4 py-2.5 text-sm font-semibold text-dark-4 dark:border-stroke-dark">Batal</button><button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">{editingProductId ? "Simpan perubahan" : "Simpan menu"}</button></div>
        </form>
      </div>}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-[#0e1a2b] dark:text-white";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-3 block text-xs font-semibold text-dark-4">{label}<div className="mt-1">{children}</div></label>; }
function Metric({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: string }) { return <div className="rounded-2xl border border-stroke bg-white p-4 shadow-1 dark:border-stroke-dark dark:bg-gray-dark sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-dark-5 sm:text-sm">{title}</span><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span></div><p className="mt-3 text-xl font-bold text-dark dark:text-white sm:text-2xl">{value}</p><p className="mt-1 text-xs text-dark-5">{detail}</p></div>; }
function ProductPhoto({ product, className = "" }: { product: Product; className?: string }) {
  const src = photoHref(product.photo_url);
  return <span className={`relative block overflow-hidden bg-[#f0eee9] dark:bg-[#1a2635] ${className}`}>{src ? <img src={src} alt={product.name} className="size-full object-cover"/> : <span className="flex size-full flex-col items-center justify-center gap-1 text-[#69716f]"><Icon name="image"/><span className="text-[9px] font-semibold uppercase tracking-[.14em]">{product.name.slice(0, 2)}</span></span>}</span>;
}
function Icon({ name }: { name: "plus" | "close" | "image" | "upload" | "search" }) {
  const paths: Record<typeof name, string> = {
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6 6 18",
    image: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zm0 11 4.5-4.5 3 3 3.5-4 5 5M8.5 9.5h.01",
    upload: "M12 16V4m0 0L7 9m5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4",
    search: "m20 20-4.4-4.4M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
  };
  return <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
