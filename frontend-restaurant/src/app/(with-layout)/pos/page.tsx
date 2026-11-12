"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  Card,
  Row,
  Col,
  Tabs,
  Button,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
  Space,
  Table as AntdTable,
  Modal,
  Form,
  Radio,
  Checkbox,
  Upload,
  Statistic,
  Divider,
  Empty,
  Badge,
  Alert,
  Popconfirm,
} from "antd";
import {
  ShoppingCartOutlined,
  InboxOutlined,
  LineChartOutlined,
  TeamOutlined,
  CalendarOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DeleteOutlined,
  CheckOutlined,
  BarcodeOutlined,
  EditOutlined,
  ShopOutlined,
  CreditCardOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  UsbOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import {
  buildThermalReceipt,
  printViaUSB,
  printViaBluetooth,
} from "@/lib/thermalPrinter";

const { Title, Text } = Typography;

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";
const photoHref = (url?: string | null) =>
  !url
    ? null
    : url.startsWith("http")
    ? url
    : `${API.replace(/\/api\/?$/, "")}${url.startsWith("/") ? url : `/${url}`}`;

const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const endSlot = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + 90;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
};

type Product = {
  id: number;
  name: string;
  category: string;
  barcode: string | null;
  price: number;
  stock: number;
  active?: boolean;
  photo_path?: string | null;
  photo_url?: string | null;
  is_bundle: boolean;
  bundle_items?: string | { product_id: number; quantity: number }[] | null;
};

type Outlet = { id: string; name: string; address?: string };
type Customer = {
  id: number;
  name: string;
  phone: string;
  points: number;
  total_spent: number;
};
type Sale = {
  id: number;
  receipt_number: string;
  payment_method: string;
  total: number;
  discount: number;
  created_at: string;
};
type Reservation = {
  id: number;
  customer_name: string;
  phone?: string;
  party_size: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  space_id: number;
  space_name: string;
};
type ReservationSpace = { id: number; name: string; capacity: number };
type CartLine = { product: Product; quantity: number };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(isMultipart ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.message ||
        Object.values(body.errors || {})
          .flat()
          .join(" ") ||
        "Permintaan gagal."
    );
  return body as T;
}

export default function PosPage() {
  const [tab, setTab] = useState("kasir");
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
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(localDate());
  const [notice, setNotice] = useState("");

  // Receipt & change modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("58mm");
  const [printing, setPrinting] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    items: { name: string; quantity: number; price: number; lineTotal: number }[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    cashReceived: number;
    change: number;
    customerName?: string;
    date: string;
  } | null>(null);

  // Product modal
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    barcode: "",
    category: "Makanan",
    price: "",
    stock: "",
    is_bundle: false,
    bundle_product_ids: [] as number[],
  });

  // Forms
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "" });
  const [reservationForm, setReservationForm] = useState({
    customer_name: "",
    phone: "",
    party_size: "2",
    reservation_date: localDate(),
    start_time: "18:00",
    space_id: "",
    notes: "",
  });

  const loadBase = useCallback(async () => {
    try {
      const [outletData, productData, customerData] = await Promise.all([
        api<Outlet[]>("/pos/outlets"),
        api<Product[]>(`/pos/products?outlet_id=${outletId}`),
        api<Customer[]>("/pos/customers"),
      ]);
      setOutlets(outletData);
      setProducts(productData);
      setCustomers(customerData);
      if (outletData.length && !outletData.some((item) => item.id === outletId))
        setOutletId(outletData[0].id);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Backend POS belum tersambung."
      );
    }
  }, [outletId]);

  const loadSales = useCallback(async () => {
    try {
      const data = await api<{ sales: Sale[] }>(
        `/pos/sales?outlet_id=${outletId}&from=${date}&to=${date}`
      );
      setSales(data.sales);
    } catch {
      setSales([]);
    }
  }, [outletId, date]);

  const loadReservations = useCallback(async () => {
    try {
      const [reservationData, spaceData] = await Promise.all([
        api<Reservation[]>(
          `/pos/reservations?outlet_id=${outletId}&date=${reservationForm.reservation_date}`
        ),
        api<ReservationSpace[]>(`/pos/spaces?outlet_id=${outletId}`),
      ]);
      setReservations(reservationData);
      setSpaces(spaceData);
      if (
        spaceData.length &&
        !spaceData.some((space) => String(space.id) === reservationForm.space_id)
      ) {
        setReservationForm((form) => ({
          ...form,
          space_id: String(spaceData[0].id),
        }));
      }
    } catch {
      setReservations([]);
    }
  }, [outletId, reservationForm.reservation_date, reservationForm.space_id]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active !== false &&
          (category === "Semua" || p.category === category) &&
          `${p.name} ${p.barcode || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [products, category, query]
  );

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const total = Math.max(0, subtotal - Math.min(discount || 0, subtotal));
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  // Cash payment & change calculations
  const effectiveCash = cashReceived !== null ? cashReceived : total;
  const change =
    payment === "tunai" ? Math.max(0, effectiveCash - total) : 0;
  const isUnderpaid =
    payment === "tunai" && cashReceived !== null && cashReceived < total;

  // Smart quick-cash suggestions based on total
  const quickCashOptions = useMemo(() => {
    if (total <= 0) return [];
    const options = new Set<number>();

    const next10k = Math.ceil(total / 10000) * 10000;
    const next50k = Math.ceil(total / 50000) * 50000;
    const next100k = Math.ceil(total / 100000) * 100000;
    if (next10k > total) options.add(next10k);
    if (next50k > total) options.add(next50k);
    if (next100k > total) options.add(next100k);

    [10000, 20000, 50000, 100000, 200000, 500000].forEach((denom) => {
      if (denom > total) options.add(denom);
    });

    return Array.from(options)
      .sort((a, b) => a - b)
      .slice(0, 3);
  }, [total]);

  const addToCart = (product: Product) => {
    if (
      !product.is_bundle &&
      product.stock <
        (cart.find((item) => item.product.id === product.id)?.quantity || 0) + 1
    ) {
      toast.error("Stok produk tidak mencukupi.");
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      return existing
        ? items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...items, { product, quantity: 1 }];
    });
  };

  const scan = (value: string) => {
    const product = products.find((item) => item.barcode === value.trim());
    if (product) {
      addToCart(product);
      setQuery("");
      toast.success(`${product.name} ditambahkan ke pesanan`);
    } else if (value.trim()) {
      toast.error("Barcode tidak ditemukan di outlet ini.");
    }
  };

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const result = await api<{ sale: Sale }>("/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          outlet_id: outletId,
          payment_method: payment,
          customer_id: customerId ? Number(customerId) : null,
          discount,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      const finalCash =
        payment === "tunai" ? (cashReceived !== null ? cashReceived : total) : total;
      const finalChange =
        payment === "tunai" ? Math.max(0, finalCash - total) : 0;

      setReceiptData({
        receiptNumber: result.sale.receipt_number,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          lineTotal: item.product.price * item.quantity,
        })),
        subtotal,
        discount,
        total,
        paymentMethod: payment,
        cashReceived: finalCash,
        change: finalChange,
        customerName: customers.find((c) => String(c.id) === customerId)?.name,
        date: new Date().toLocaleString("id-ID"),
      });

      setReceiptModalOpen(true);
      toast.success(`Transaksi ${result.sale.receipt_number} berhasil disimpan.`);
      setCart([]);
      setDiscount(0);
      setCustomerId("");
      setCashReceived(null);
      await Promise.all([loadBase(), loadSales()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transaksi gagal disimpan."
      );
      await loadBase();
    } finally {
      setBusy(false);
    }
  };

  const handlePrintUSB = async () => {
    if (!receiptData) return;
    setPrinting(true);
    try {
      const bytes = buildThermalReceipt({ ...receiptData, paperWidth });
      await printViaUSB(bytes);
      toast.success("Struk berhasil dikirim ke printer USB!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mencetak via USB.");
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintBluetooth = async () => {
    if (!receiptData) return;
    setPrinting(true);
    try {
      const bytes = buildThermalReceipt({ ...receiptData, paperWidth });
      await printViaBluetooth(bytes);
      toast.success("Struk berhasil dikirim ke printer Bluetooth!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mencetak via Bluetooth.");
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintBrowser = () => {
    window.print();
  };

  const openNewProduct = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      barcode: "",
      category: "Makanan",
      price: "",
      stock: "",
      is_bundle: false,
      bundle_product_ids: [],
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setMenuEditorOpen(true);
  };

  const openEditProduct = (product: Product) => {
    const parts =
      typeof product.bundle_items === "string"
        ? JSON.parse(product.bundle_items || "[]")
        : product.bundle_items || [];
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      barcode: product.barcode || "",
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      is_bundle: product.is_bundle,
      bundle_product_ids: parts.map(
        (part: { product_id: number }) => part.product_id
      ),
    });
    setPhotoFile(null);
    setPhotoPreview(photoHref(product.photo_url));
    setMenuEditorOpen(true);
  };

  const saveProduct = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    try {
      const bundle_items = productForm.bundle_product_ids.map((product_id) => ({
        product_id,
        quantity: 1,
      }));
      if (productForm.is_bundle && !bundle_items.length) {
        toast.error("Pilih minimal satu produk untuk komposisi paket.");
        return;
      }
      const body = new FormData();
      body.append("outlet_id", outletId);
      body.append("name", productForm.name);
      body.append("barcode", productForm.barcode);
      body.append("category", productForm.category);
      body.append("price", productForm.price);
      body.append("stock", productForm.is_bundle ? "0" : productForm.stock);
      body.append("is_bundle", productForm.is_bundle ? "1" : "0");
      bundle_items.forEach((part, index) => {
        body.append(
          `bundle_items[${index}][product_id]`,
          String(part.product_id)
        );
        body.append(`bundle_items[${index}][quantity]`, String(part.quantity));
      });
      if (photoFile) body.append("photo", photoFile);
      if (editingProductId) body.append("_method", "PATCH");

      await api<Product>(
        editingProductId ? `/pos/products/${editingProductId}` : "/pos/products",
        { method: "POST", body }
      );
      setMenuEditorOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      await loadBase();
      toast.success(
        editingProductId
          ? "Menu berhasil diperbarui."
          : "Menu baru berhasil ditambahkan."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Produk gagal disimpan."
      );
    }
  };

  const adjustStock = async (product: Product, amount: number) => {
    try {
      await api(`/pos/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Math.max(0, product.stock + amount) }),
      });
      await loadBase();
      toast.success(`Stok ${product.name} diperbarui`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Stok gagal diperbarui."
      );
    }
  };

  const createCustomer = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    try {
      await api("/pos/customers", {
        method: "POST",
        body: JSON.stringify(customerForm),
      });
      setCustomerForm({ name: "", phone: "" });
      await loadBase();
      toast.success("Pelanggan berhasil didaftarkan.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pelanggan gagal disimpan."
      );
    }
  };

  const createReservation = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!reservationForm.customer_name.trim()) {
      toast.error("Nama pemesan wajib diisi.");
      return;
    }
    if (!reservationForm.space_id) {
      toast.error("Silakan pilih meja yang tersedia.");
      return;
    }
    const start = reservationForm.start_time;
    const end = endSlot(start);
    try {
      await api("/pos/reservations", {
        method: "POST",
        body: JSON.stringify({
          ...reservationForm,
          outlet_id: outletId,
          space_id: Number(reservationForm.space_id),
          party_size: Number(reservationForm.party_size),
          end_time: end,
        }),
      });
      await loadReservations();
      toast.success("Reservasi berhasil dikonfirmasi dan tersimpan di database.");
      setReservationForm((form) => ({
        ...form,
        customer_name: "",
        phone: "",
        notes: "",
        space_id: "",
      }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Jadwal sudah terisi atau data tidak valid."
      );
      await loadReservations();
    }
  };

  const slots = [
    "11:00",
    "12:30",
    "14:00",
    "17:00",
    "18:00",
    "19:00",
    "20:30",
  ];

  const availableSpaces = spaces.filter(
    (space) =>
      space.capacity >= Number(reservationForm.party_size) &&
      !reservations.some(
        (item) =>
          item.status === "confirmed" &&
          item.space_id === space.id &&
          minutes(reservationForm.start_time) < minutes(item.end_time) &&
          minutes(endSlot(reservationForm.start_time)) > minutes(item.start_time)
      )
  );

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {/* Top Header Controls */}
      <Card
        variant="borderless"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        styles={{ body: { padding: "14px 20px" } }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Space>
            <Select
              value={outletId}
              onChange={(val) => {
                setOutletId(val);
                setCart([]);
              }}
              style={{ width: 190 }}
              options={outlets.map((o) => ({ label: o.name, value: o.id }))}
            />
            <Tag color="cyan">{outlets.find((o) => o.id === outletId)?.name}</Tag>
          </Space>

          <Space>
            <Statistic
              title="Omzet Hari Ini"
              value={revenue}
              precision={0}
              prefix="Rp"
              styles={{ content: { fontSize: 16, color: "#1677ff", fontWeight: "bold" } }}
            />
            <Divider orientation="vertical" style={{ height: 32 }} />
            <Statistic
              title="Transaksi"
              value={sales.length}
              styles={{ content: { fontSize: 16, fontWeight: "bold" } }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openNewProduct}
              style={{ marginLeft: 8 }}
            >
              Tambah Menu
            </Button>
          </Space>
        </div>
      </Card>

      {notice && (
        <Alert
          message="Koneksi POS Backend"
          description={notice}
          type="warning"
          showIcon
          closable
        />
      )}

      {/* Main Tabs Container */}
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k)}
        type="card"
        items={[
          {
            key: "kasir",
            label: (
              <span>
                <ShoppingCartOutlined /> Kasir (POS)
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {/* Catalog / Products Grid */}
                <Col xs={24} lg={15} xl={16}>
                  <Card
                    variant="borderless"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <Input.Search
                        placeholder="Cari nama menu atau scan barcode..."
                        allowClear
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onSearch={(val) => scan(val)}
                        style={{ maxWidth: 320 }}
                        prefix={<SearchOutlined />}
                      />

                      <Radio.Group
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        buttonStyle="solid"
                        size="small"
                      >
                        {categories.map((c) => (
                          <Radio.Button key={c} value={c}>
                            {c}
                          </Radio.Button>
                        ))}
                      </Radio.Group>
                    </div>

                    {filtered.length === 0 ? (
                      <Empty description="Tidak ada menu di outlet ini. Gunakan Tambah Menu untuk membuat menu baru." />
                    ) : (
                      <Row gutter={[12, 12]}>
                        {filtered.map((product) => {
                          const src = photoHref(product.photo_url);
                          const isOutOfStock =
                            !product.is_bundle && product.stock === 0;

                          return (
                            <Col xs={12} sm={8} md={8} xl={6} key={product.id}>
                              <Card
                                hoverable
                                size="small"
                                onClick={() =>
                                  !isOutOfStock && addToCart(product)
                                }
                                style={{
                                  borderRadius: 8,
                                  opacity: isOutOfStock ? 0.5 : 1,
                                  cursor: isOutOfStock
                                    ? "not-allowed"
                                    : "pointer",
                                }}
                                cover={
                                  <div
                                    style={{
                                      height: 110,
                                      background: "#f5f5f5",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {src ? (
                                      <img
                                        src={src}
                                        alt={product.name}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : (
                                      <InboxOutlined
                                        style={{ fontSize: 32, color: "#bfbfbf" }}
                                      />
                                    )}
                                  </div>
                                }
                              >
                                <div style={{ minHeight: 65 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <Text
                                      strong
                                      ellipsis={{ tooltip: product.name }}
                                      style={{ fontSize: 13 }}
                                    >
                                      {product.name}
                                    </Text>
                                    {product.is_bundle && (
                                      <Tag color="purple" style={{ fontSize: 10 }}>
                                        Paket
                                      </Tag>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 4 }}>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: 11 }}
                                    >
                                      {product.is_bundle
                                        ? "Bundle Item"
                                        : `Stok: ${product.stock}`}
                                    </Text>
                                  </div>
                                  <div style={{ marginTop: 6 }}>
                                    <Text
                                      strong
                                      style={{ color: "#1677ff", fontSize: 14 }}
                                    >
                                      {money(product.price)}
                                    </Text>
                                  </div>
                                </div>
                              </Card>
                            </Col>
                          );
                        })}
                      </Row>
                    )}
                  </Card>
                </Col>

                {/* Cart Side Panel */}
                <Col xs={24} lg={9} xl={8}>
                  <Card
                    title={
                      <Space>
                        <ShoppingCartOutlined style={{ color: "#1677ff" }} />
                        <span>Pesanan Aktif</span>
                        <Badge
                          count={cart.reduce(
                            (sum, item) => sum + item.quantity,
                            0
                          )}
                          style={{ backgroundColor: "#1677ff" }}
                        />
                      </Space>
                    }
                    extra={
                      cart.length > 0 && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() => setCart([])}
                        >
                          Kosongkan
                        </Button>
                      )
                    }
                    variant="borderless"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    {cart.length === 0 ? (
                      <Empty description="Belum ada menu yang dipilih." />
                    ) : (
                      <div
                        style={{
                          maxHeight: 280,
                          overflowY: "auto",
                          marginBottom: 16,
                        }}
                      >
                        {cart.map((item) => (
                          <div
                            key={item.product.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 0",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                          >
                            <div style={{ maxWidth: 140 }}>
                              <Text strong style={{ fontSize: 13 }}>
                                {item.product.name}
                              </Text>
                              <div>
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 11 }}
                                >
                                  {money(item.product.price)}
                                </Text>
                              </div>
                            </div>

                            <Space size="small">
                              <Button
                                size="small"
                                onClick={() =>
                                  setCart((items) =>
                                    items.flatMap((l) =>
                                      l.product.id === item.product.id
                                        ? l.quantity > 1
                                          ? [
                                              {
                                                ...l,
                                                quantity: l.quantity - 1,
                                              },
                                            ]
                                          : []
                                        : [l]
                                    )
                                  )
                                }
                              >
                                -
                              </Button>
                              <Text strong>{item.quantity}</Text>
                              <Button
                                size="small"
                                onClick={() => addToCart(item.product)}
                              >
                                +
                              </Button>
                            </Space>

                            <Text strong style={{ minWidth: 70, textAlign: "right" }}>
                              {money(item.product.price * item.quantity)}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}

                    <Divider style={{ margin: "12px 0" }} />

                    {/* Customer Selection & Discount */}
                    <Space
                      orientation="vertical"
                      size="small"
                      style={{ width: "100%" }}
                    >
                      <div>
                        <Text strong style={{ fontSize: 12 }}>
                          Pelanggan Loyal (Member)
                        </Text>
                        <Select
                          placeholder="Pilih Pelanggan Umum"
                          allowClear
                          value={customerId || undefined}
                          onChange={(val) => setCustomerId(val || "")}
                          style={{ width: "100%", marginTop: 4 }}
                          options={customers.map((c) => ({
                            label: `${c.name} (${c.points} Poin)`,
                            value: String(c.id),
                          }))}
                        />
                      </div>

                      <div>
                        <Text strong style={{ fontSize: 12 }}>
                          Potongan Diskon (Rp)
                        </Text>
                        <InputNumber
                          min={0}
                          max={subtotal}
                          value={discount}
                          onChange={(val) => setDiscount(val || 0)}
                          style={{ width: "100%", marginTop: 4 }}
                          prefix="Rp"
                        />
                      </div>

                      <div>
                        <Text strong style={{ fontSize: 12 }}>
                          Metode Pembayaran
                        </Text>
                        <Radio.Group
                          value={payment}
                          onChange={(e) => {
                            setPayment(e.target.value);
                            if (e.target.value !== "tunai") setCashReceived(null);
                          }}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          <Radio.Button value="tunai">Tunai</Radio.Button>
                          <Radio.Button value="qris">QRIS</Radio.Button>
                          <Radio.Button value="kartu">Kartu</Radio.Button>
                          <Radio.Button value="transfer">Transfer</Radio.Button>
                        </Radio.Group>
                      </div>

                      {/* Cash Input & Change Calculation */}
                      {payment === "tunai" && total > 0 && (
                        <div
                          style={{
                            background: "#fafafa",
                            border: "1px solid #f0f0f0",
                            borderRadius: 8,
                            padding: "10px 12px",
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text strong style={{ fontSize: 12 }}>
                              Uang Tunai Diterima (Rp)
                            </Text>
                            <Button
                              type={cashReceived === total ? "primary" : "dashed"}
                              size="small"
                              onClick={() => setCashReceived(total)}
                              style={{ fontSize: 11 }}
                            >
                              Uang Pas
                            </Button>
                          </div>

                          <InputNumber
                            min={0}
                            value={cashReceived ?? undefined}
                            placeholder={`Ketik nominal uang (cth: ${money(total)})`}
                            onChange={(val) => setCashReceived(val ?? null)}
                            style={{ width: "100%", marginTop: 6 }}
                            prefix="Rp"
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                              Number(value?.replace(/\$\s?|(,*)/g, "") || 0)
                            }
                          />

                          {/* Quick cash denomination buttons */}
                          {quickCashOptions.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                marginTop: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {quickCashOptions.map((opt) => (
                                <Button
                                  key={opt}
                                  size="small"
                                  type={cashReceived === opt ? "primary" : "default"}
                                  onClick={() => setCashReceived(opt)}
                                  style={{ fontSize: 11 }}
                                >
                                  {money(opt)}
                                </Button>
                              ))}
                            </div>
                          )}

                          {/* Live Change / Underpaid Status */}
                          {cashReceived !== null && (
                            <div style={{ marginTop: 8 }}>
                              {isUnderpaid ? (
                                <div
                                  style={{
                                    background: "#fff2e8",
                                    border: "1px solid #ffbb96",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ color: "#d4380d", fontSize: 12 }}>
                                    Uang Kurang
                                  </Text>
                                  <Text strong style={{ color: "#ff4d4f", fontSize: 13 }}>
                                    - {money(total - cashReceived)}
                                  </Text>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    background: change > 0 ? "#f6ffed" : "#f0f5ff",
                                    border: `1px solid ${
                                      change > 0 ? "#b7eb8f" : "#91caff"
                                    }`,
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text
                                    strong
                                    style={{
                                      color: change > 0 ? "#389e0d" : "#0958d9",
                                      fontSize: 12,
                                    }}
                                  >
                                    {change > 0 ? "Kembalian" : "Status"}
                                  </Text>
                                  <Text
                                    strong
                                    style={{
                                      color: change > 0 ? "#52c41a" : "#1677ff",
                                      fontSize: 16,
                                    }}
                                  >
                                    {change > 0 ? money(change) : "Uang Pas"}
                                  </Text>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <Divider style={{ margin: "12px 0" }} />

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                        }}
                      >
                        <Text type="secondary">Subtotal</Text>
                        <Text strong>{money(subtotal)}</Text>
                      </div>

                      {discount > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            color: "#52c41a",
                          }}
                        >
                          <Text style={{ color: "#52c41a" }}>Diskon</Text>
                          <Text strong style={{ color: "#52c41a" }}>
                            - {money(discount)}
                          </Text>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 16,
                          marginTop: 6,
                        }}
                      >
                        <Text strong>Total Akhir</Text>
                        <Text strong style={{ color: "#1677ff", fontSize: 18 }}>
                          {money(total)}
                        </Text>
                      </div>

                      {/* Display Change in Summary if Cash > Total */}
                      {payment === "tunai" &&
                        cashReceived !== null &&
                        cashReceived > total && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 14,
                              marginTop: 4,
                              background: "#f6ffed",
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #b7eb8f",
                            }}
                          >
                            <Text strong style={{ color: "#389e0d" }}>
                              Kembalian
                            </Text>
                            <Text strong style={{ color: "#52c41a", fontSize: 16 }}>
                              {money(change)}
                            </Text>
                          </div>
                        )}

                      <Button
                        type="primary"
                        size="large"
                        block
                        disabled={cart.length === 0 || busy || isUnderpaid}
                        loading={busy}
                        onClick={() => void checkout()}
                        style={{ marginTop: 12 }}
                      >
                        {busy
                          ? "Memproses..."
                          : isUnderpaid
                          ? `Uang Kurang (${money(total - (cashReceived || 0))})`
                          : `Bayar ${money(total)}`}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "persediaan",
            label: (
              <span>
                <InboxOutlined /> Menu & Persediaan
              </span>
            ),
            children: (
              <Card
                variant="borderless"
                title="Katalog Menu & Manajemen Stok"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openNewProduct}
                  >
                    Tambah Menu Baru
                  </Button>
                }
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              >
                <AntdTable
                  dataSource={products}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "Menu",
                      key: "name",
                      render: (_, p) => {
                        const src = photoHref(p.photo_url);
                        return (
                          <Space>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                overflow: "hidden",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={p.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <InboxOutlined style={{ color: "#bfbfbf" }} />
                              )}
                            </div>
                            <div>
                              <Text strong>{p.name}</Text>
                              <div>
                                <Tag color={p.is_bundle ? "purple" : "blue"}>
                                  {p.is_bundle ? "Paket" : p.category}
                                </Tag>
                              </div>
                            </div>
                          </Space>
                        );
                      },
                    },
                    {
                      title: "Barcode",
                      dataIndex: "barcode",
                      key: "barcode",
                      render: (b) => b || "—",
                    },
                    {
                      title: "Harga",
                      dataIndex: "price",
                      key: "price",
                      render: (price) => (
                        <Text strong>{money(Number(price))}</Text>
                      ),
                    },
                    {
                      title: "Stok",
                      key: "stock",
                      render: (_, p) =>
                        p.is_bundle ? (
                          <Tag color="default">Paket Bahan</Tag>
                        ) : (
                          <Tag color={p.stock <= 10 ? "error" : "success"}>
                            {p.stock} Unit
                          </Tag>
                        ),
                    },
                    {
                      title: "Aksi",
                      key: "action",
                      render: (_, p) => (
                        <Space>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditProduct(p)}
                          >
                            Edit
                          </Button>
                          {!p.is_bundle && (
                            <>
                              <Button
                                size="small"
                                onClick={() => void adjustStock(p, -1)}
                              >
                                -1
                              </Button>
                              <Button
                                size="small"
                                onClick={() => void adjustStock(p, 1)}
                              >
                                +1
                              </Button>
                            </>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "laporan",
            label: (
              <span>
                <LineChartOutlined /> Laporan Penjualan
              </span>
            ),
            children: (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Card variant="borderless">
                      <Statistic
                        title="Omzet Bersih"
                        value={revenue}
                        precision={0}
                        prefix="Rp"
                        styles={{ content: { color: "#52c41a" } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card variant="borderless">
                      <Statistic
                        title="Total Transaksi"
                        value={sales.length}
                        suffix="Struk"
                        styles={{ content: { color: "#1677ff" } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card variant="borderless">
                      <Statistic
                        title="Total Diskon Diberikan"
                        value={sales.reduce(
                          (sum, s) => sum + Number(s.discount),
                          0
                        )}
                        prefix="Rp"
                        styles={{ content: { color: "#faad14" } }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  variant="borderless"
                  title="Daftar Struk Penjualan"
                  extra={
                    <Space>
                      <Text>Tanggal:</Text>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ width: 160 }}
                      />
                    </Space>
                  }
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <AntdTable
                    dataSource={sales}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      {
                        title: "Nomor Struk",
                        dataIndex: "receipt_number",
                        key: "receipt_number",
                        render: (r) => <Text strong>{r}</Text>,
                      },
                      {
                        title: "Waktu",
                        dataIndex: "created_at",
                        key: "created_at",
                        render: (dt) =>
                          new Date(dt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                      },
                      {
                        title: "Metode",
                        dataIndex: "payment_method",
                        key: "payment_method",
                        render: (m) => <Tag color="blue">{String(m).toUpperCase()}</Tag>,
                      },
                      {
                        title: "Diskon",
                        dataIndex: "discount",
                        key: "discount",
                        render: (d) => money(Number(d)),
                      },
                      {
                        title: "Total",
                        dataIndex: "total",
                        key: "total",
                        render: (tot) => (
                          <Text strong style={{ color: "#1677ff" }}>
                            {money(Number(tot))}
                          </Text>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: "pelanggan",
            label: (
              <span>
                <TeamOutlined /> Pelanggan Loyal
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={15}>
                  <Card
                    variant="borderless"
                    title="Daftar Member & Poin Pelanggan"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <AntdTable
                      dataSource={customers}
                      rowKey="id"
                      pagination={{ pageSize: 8 }}
                      columns={[
                        {
                          title: "Nama",
                          dataIndex: "name",
                          key: "name",
                          render: (name) => <Text strong>{name}</Text>,
                        },
                        {
                          title: "No. Telepon",
                          dataIndex: "phone",
                          key: "phone",
                        },
                        {
                          title: "Poin Loyalti",
                          dataIndex: "points",
                          key: "points",
                          render: (pts) => (
                            <Tag color="purple">{pts} Poin</Tag>
                          ),
                        },
                        {
                          title: "Total Belanja",
                          dataIndex: "total_spent",
                          key: "total_spent",
                          render: (spent) => money(Number(spent)),
                        },
                      ]}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={9}>
                  <Card
                    variant="borderless"
                    title="Daftarkan Pelanggan Baru"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <form onSubmit={createCustomer}>
                      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        <div>
                          <Text strong>Nama Lengkap</Text>
                          <Input
                            placeholder="Contoh: Budi Santoso"
                            required
                            value={customerForm.name}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                name: e.target.value,
                              })
                            }
                            style={{ marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <Text strong>Nomor WhatsApp / HP</Text>
                          <Input
                            placeholder="Contoh: 08123456789"
                            required
                            value={customerForm.phone}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                phone: e.target.value,
                              })
                            }
                            style={{ marginTop: 4 }}
                          />
                        </div>
                        <Button type="primary" htmlType="submit" block size="large">
                          Daftarkan Member
                        </Button>
                      </Space>
                    </form>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "reservasi",
            label: (
              <span>
                <CalendarOutlined /> Reservasi Meja
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={15}>
                  <Card
                    variant="borderless"
                    title="Jadwal Reservasi Meja"
                    extra={
                      <Space>
                        <Text>Tanggal:</Text>
                        <Input
                          type="date"
                          value={reservationForm.reservation_date}
                          onChange={(e) =>
                            setReservationForm({
                              ...reservationForm,
                              reservation_date: e.target.value,
                            })
                          }
                          style={{ width: 160 }}
                        />
                      </Space>
                    }
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <AntdTable
                      dataSource={reservations}
                      rowKey="id"
                      pagination={{ pageSize: 8 }}
                      columns={[
                        {
                          title: "Jam Slot",
                          key: "time",
                          render: (_, r) => (
                            <Text strong>
                              {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}
                            </Text>
                          ),
                        },
                        {
                          title: "Pemesan",
                          dataIndex: "customer_name",
                          key: "customer_name",
                          render: (name) => <Text strong>{name}</Text>,
                        },
                        {
                          title: "Meja",
                          dataIndex: "space_name",
                          key: "space_name",
                        },
                        {
                          title: "Jumlah",
                          dataIndex: "party_size",
                          key: "party_size",
                          render: (p) => `${p} orang`,
                        },
                        {
                          title: "Status",
                          dataIndex: "status",
                          key: "status",
                          render: (st) => (
                            <Tag
                              color={
                                st === "confirmed"
                                  ? "blue"
                                  : st === "arrived"
                                  ? "orange"
                                  : st === "seated"
                                  ? "green"
                                  : "default"
                              }
                            >
                              {st}
                            </Tag>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={9}>
                  <Card
                    variant="borderless"
                    title="Buat Reservasi Baru"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <form onSubmit={createReservation}>
                      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        <div>
                          <Text strong>Nama Pemesan</Text>
                          <Input
                            placeholder="Nama pemesan"
                            required
                            value={reservationForm.customer_name}
                            onChange={(e) =>
                              setReservationForm({
                                ...reservationForm,
                                customer_name: e.target.value,
                              })
                            }
                            style={{ marginTop: 4 }}
                          />
                        </div>

                        <div>
                          <Text strong>Tanggal Reservasi</Text>
                          <Input
                            type="date"
                            min={localDate()}
                            required
                            value={reservationForm.reservation_date}
                            onChange={(e) =>
                              setReservationForm({
                                ...reservationForm,
                                reservation_date: e.target.value,
                              })
                            }
                            style={{ marginTop: 4 }}
                          />
                        </div>

                        <Row gutter={8}>
                          <Col span={12}>
                            <Text strong>Telepon</Text>
                            <Input
                              placeholder="08..."
                              value={reservationForm.phone}
                              onChange={(e) =>
                                setReservationForm({
                                  ...reservationForm,
                                  phone: e.target.value,
                                })
                              }
                              style={{ marginTop: 4 }}
                            />
                          </Col>
                          <Col span={12}>
                            <Text strong>Tamu</Text>
                            <InputNumber
                              min={1}
                              max={40}
                              value={Number(reservationForm.party_size)}
                              onChange={(val) => {
                                const newParty = String(val || 2);
                                const selectedSpace = spaces.find(
                                  (s) => String(s.id) === reservationForm.space_id
                                );
                                const needsReset =
                                  selectedSpace &&
                                  selectedSpace.capacity < Number(newParty);
                                setReservationForm({
                                  ...reservationForm,
                                  party_size: newParty,
                                  space_id: needsReset ? "" : reservationForm.space_id,
                                });
                              }}
                              style={{ width: "100%", marginTop: 4 }}
                            />
                          </Col>
                        </Row>
                        <div>
                          <Text strong>Pilih Jam</Text>
                          <Select
                            value={reservationForm.start_time}
                            onChange={(val) =>
                              setReservationForm({
                                ...reservationForm,
                                start_time: val,
                              })
                            }
                            style={{ width: "100%", marginTop: 4 }}
                            options={slots.map((s) => ({ label: s, value: s }))}
                          />
                        </div>
                        <div>
                          <Text strong>Pilih Meja Tersedia</Text>
                          <Select
                            placeholder="Pilih meja"
                            value={reservationForm.space_id || undefined}
                            onChange={(val) =>
                              setReservationForm({
                                ...reservationForm,
                                space_id: val,
                              })
                            }
                            style={{ width: "100%", marginTop: 4 }}
                            options={availableSpaces.map((sp) => ({
                              label: `${sp.name} (Hingga ${sp.capacity} orang)`,
                              value: String(sp.id),
                            }))}
                          />
                        </div>
                        <div>
                          <Text strong>Catatan Khusus</Text>
                          <Input.TextArea
                            placeholder="Permintaan khusus meja (opsional)"
                            value={reservationForm.notes}
                            onChange={(e) =>
                              setReservationForm({
                                ...reservationForm,
                                notes: e.target.value,
                              })
                            }
                            style={{ marginTop: 4 }}
                          />
                        </div>
                        <Button
                          type="primary"
                          htmlType="submit"
                          block
                          size="large"
                          disabled={!availableSpaces.length}
                        >
                          {availableSpaces.length
                            ? "Konfirmasi Reservasi"
                            : "Tidak Ada Meja Tersedia"}
                        </Button>
                      </Space>
                    </form>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* Modal: Add/Edit Product */}
      <Modal
        title={editingProductId ? "Edit Katalog Menu" : "Tambah Menu Baru"}
        open={menuEditorOpen}
        onCancel={() => setMenuEditorOpen(false)}
        footer={null}
      >
        <form onSubmit={saveProduct}>
          <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 16 }}>
            <div>
              <Text strong>Nama Menu</Text>
              <Input
                placeholder="Contoh: Kopi Susu Aren"
                required
                value={productForm.name}
                onChange={(e) =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                style={{ marginTop: 4 }}
              />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <Text strong>Kategori</Text>
                <Select
                  value={productForm.category}
                  onChange={(val) =>
                    setProductForm({ ...productForm, category: val })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  options={[
                    { label: "Makanan", value: "Makanan" },
                    { label: "Minuman", value: "Minuman" },
                    { label: "Snack", value: "Snack" },
                    { label: "Paket", value: "Paket" },
                    { label: "Lainnya", value: "Lainnya" },
                  ]}
                />
              </Col>
              <Col span={12}>
                <Text strong>Harga (Rp)</Text>
                <InputNumber
                  min={0}
                  required
                  value={Number(productForm.price)}
                  onChange={(val) =>
                    setProductForm({
                      ...productForm,
                      price: String(val || 0),
                    })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  prefix="Rp"
                />
              </Col>
            </Row>

            <div>
              <Text strong>Barcode</Text>
              <Input
                placeholder="Pindai atau ketik barcode"
                value={productForm.barcode}
                onChange={(e) =>
                  setProductForm({ ...productForm, barcode: e.target.value })
                }
                style={{ marginTop: 4 }}
                prefix={<BarcodeOutlined />}
              />
            </div>

            <Checkbox
              checked={productForm.is_bundle}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  is_bundle: e.target.checked,
                  category: e.target.checked ? "Paket" : "Makanan",
                })
              }
            >
              Menu ini merupakan Paket / Bundle
            </Checkbox>

            {productForm.is_bundle ? (
              <div>
                <Text strong>Pilih Komposisi Item Paket</Text>
                <Select
                  mode="multiple"
                  placeholder="Pilih item untuk paket"
                  value={productForm.bundle_product_ids}
                  onChange={(vals) =>
                    setProductForm({
                      ...productForm,
                      bundle_product_ids: vals,
                    })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  options={products
                    .filter((p) => !p.is_bundle && p.id !== editingProductId)
                    .map((p) => ({
                      label: `${p.name} (Stok ${p.stock})`,
                      value: p.id,
                    }))}
                />
              </div>
            ) : (
              <div>
                <Text strong>
                  {editingProductId ? "Stok Saat Ini" : "Stok Awal"}
                </Text>
                <InputNumber
                  min={0}
                  required
                  value={Number(productForm.stock)}
                  onChange={(val) =>
                    setProductForm({
                      ...productForm,
                      stock: String(val || 0),
                    })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                />
              </div>
            )}

            <div>
              <Text strong>Foto Menu</Text>
              <div style={{ marginTop: 6 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </div>
              {photoPreview && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <Button onClick={() => setMenuEditorOpen(false)}>Batal</Button>
              <Button type="primary" htmlType="submit">
                {editingProductId ? "Simpan Perubahan" : "Simpan Menu"}
              </Button>
            </div>
          </Space>
        </form>
      </Modal>

      {/* Modal: Struk & Kembalian Kasir (Termal USB / Bluetooth / Browser) */}
      <Modal
        open={receiptModalOpen}
        onCancel={() => setReceiptModalOpen(false)}
        footer={[
          <Button
            key="usb"
            icon={<UsbOutlined />}
            loading={printing}
            onClick={handlePrintUSB}
            type="primary"
            style={{ background: "#1677ff" }}
          >
            Cetak USB
          </Button>,
          <Button
            key="bt"
            icon={<WifiOutlined />}
            loading={printing}
            onClick={handlePrintBluetooth}
            type="primary"
            style={{ background: "#722ed1", borderColor: "#722ed1" }}
          >
            Cetak Bluetooth
          </Button>,
          <Button
            key="browser"
            icon={<PrinterOutlined />}
            onClick={handlePrintBrowser}
          >
            Browser / PDF
          </Button>,
          <Button
            key="close"
            onClick={() => setReceiptModalOpen(false)}
          >
            Selesai
          </Button>,
        ]}
        width={460}
        centered
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
            <span>Pembayaran Berhasil</span>
          </Space>
        }
      >
        {receiptData && (
          <div style={{ marginTop: 8 }}>
            {/* Paper Width Selector & Device Info */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f5f5f5",
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 12 }}>Kertas Thermal:</Text>
              <Radio.Group
                size="small"
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value)}
              >
                <Radio.Button value="58mm">58mm (Standar)</Radio.Button>
                <Radio.Button value="80mm">80mm</Radio.Button>
              </Radio.Group>
            </div>

            {/* Kembalian Highlight Banner */}
            {receiptData.paymentMethod === "tunai" && receiptData.change > 0 && (
              <div
                style={{
                  background: "#f6ffed",
                  border: "2px dashed #52c41a",
                  borderRadius: 10,
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                <Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: 700,
                    color: "#52c41a",
                  }}
                >
                  Uang Kembalian Pelanggan
                </Text>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "#389e0d",
                    lineHeight: 1.2,
                    marginTop: 4,
                  }}
                >
                  {money(receiptData.change)}
                </div>
                <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 6 }}>
                  Total: {money(receiptData.total)} • Tunai Diterima:{" "}
                  {money(receiptData.cashReceived)}
                </div>
              </div>
            )}

            {/* Receipt Body */}
            <div
              id="printable-pos-receipt"
              style={{
                background: "#fafafa",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                padding: "16px",
                fontSize: 12,
                maxWidth: paperWidth === "58mm" ? 280 : 360,
                margin: "0 auto",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  borderBottom: "1px dashed #d9d9d9",
                  paddingBottom: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 15 }}>
                  PADA RESTO
                </div>
                <div style={{ color: "#8c8c8c", fontSize: 11 }}>
                  Outlet Jakarta
                </div>
                <div style={{ color: "#595959", marginTop: 4, fontWeight: 600 }}>
                  {receiptData.receiptNumber}
                </div>
                <div style={{ color: "#8c8c8c", fontSize: 11 }}>
                  {receiptData.date}
                </div>
                {receiptData.customerName && (
                  <div style={{ color: "#1677ff", marginTop: 2 }}>
                    Pelanggan: {receiptData.customerName}
                  </div>
                )}
              </div>

              {/* Items */}
              <div
                style={{
                  borderBottom: "1px dashed #d9d9d9",
                  paddingBottom: 10,
                  marginBottom: 10,
                }}
              >
                {receiptData.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ color: "#8c8c8c", fontSize: 11 }}>
                        {item.quantity} x {money(item.price)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600 }}>{money(item.lineTotal)}</div>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">Subtotal</Text>
                  <span>{money(receiptData.subtotal)}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#52c41a",
                    }}
                  >
                    <span>Diskon</span>
                    <span>- {money(receiptData.discount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "bold",
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  <span>Total Belanja</span>
                  <span style={{ color: "#1677ff" }}>
                    {money(receiptData.total)}
                  </span>
                </div>

                <div
                  style={{
                    borderTop: "1px dashed #d9d9d9",
                    paddingTop: 8,
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text type="secondary">Metode Bayar</Text>
                    <Tag color="blue" style={{ textTransform: "uppercase", margin: 0 }}>
                      {receiptData.paymentMethod}
                    </Tag>
                  </div>
                  {receiptData.paymentMethod === "tunai" && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 4,
                        }}
                      >
                        <Text type="secondary">Tunai Diterima</Text>
                        <span style={{ fontWeight: 600 }}>
                          {money(receiptData.cashReceived)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: "bold",
                          color: receiptData.change > 0 ? "#52c41a" : undefined,
                          marginTop: 4,
                        }}
                      >
                        <span>Kembalian</span>
                        <span style={{ fontSize: 14 }}>
                          {money(receiptData.change)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 14,
                  color: "#8c8c8c",
                  fontSize: 11,
                  borderTop: "1px dashed #d9d9d9",
                  paddingTop: 8,
                }}
              >
                Terima kasih atas kunjungan Anda!
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Space>
  );
}
