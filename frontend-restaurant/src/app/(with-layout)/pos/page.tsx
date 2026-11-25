"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { Alert, Space } from "antd";
import {
  buildThermalReceipt,
  printViaUSB,
  printViaBluetooth,
} from "@/lib/thermalPrinter";
import PosOverview from "@/features/pos/components/PosOverview";
import PosTabs from "@/features/pos/components/PosTabs";
import ProductEditorModal from "@/features/pos/components/ProductEditorModal";
import ReceiptModal from "@/features/pos/components/ReceiptModal";
import type {
  CartLine,
  Customer,
  CustomerForm,
  Outlet,
  Product,
  ProductForm,
  ReceiptData,
  Reservation,
  ReservationForm,
  ReservationSpace,
  Sale,
} from "@/features/pos/types";
import { api, endSlot, localDate, minutes, money, photoHref } from "@/features/pos/utils";

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
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Product modal
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: "",
    barcode: "",
    category: "Makanan",
    price: "",
    stock: "",
    is_bundle: false,
    bundle_product_ids: [] as number[],
  });

  // Forms
  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    name: "",
    phone: "",
  });
  const [reservationForm, setReservationForm] = useState<ReservationForm>({
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

  const createCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const createReservation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      <PosOverview
        outlets={outlets}
        outletId={outletId}
        revenue={revenue}
        transactionCount={sales.length}
        onOutletChange={(value) => {
          setOutletId(value);
          setCart([]);
        }}
        onAddProduct={openNewProduct}
      />

      {notice && (
        <Alert
          message="Koneksi POS Backend"
          description={notice}
          type="warning"
          showIcon
          closable
        />
      )}

      <PosTabs
        activeTab={tab}
        onTabChange={setTab}
        catalog={{
          products: filtered,
          categories,
          query,
          category,
          onQueryChange: setQuery,
          onCategoryChange: setCategory,
          onScan: scan,
          onAddToCart: addToCart,
        }}
        order={{
          cart,
          customers,
          customerId,
          subtotal,
          discount,
          payment,
          cashReceived,
          total,
          change,
          isUnderpaid,
          quickCashOptions,
          busy,
          onClearCart: () => setCart([]),
          onDecreaseItem: (productId) =>
            setCart((items) =>
              items.flatMap((line) =>
                line.product.id === productId
                  ? line.quantity > 1
                    ? [{ ...line, quantity: line.quantity - 1 }]
                    : []
                  : [line]
              )
            ),
          onAddToCart: addToCart,
          onCustomerChange: setCustomerId,
          onDiscountChange: setDiscount,
          onPaymentChange: (value) => {
            setPayment(value);
            if (value !== "tunai") setCashReceived(null);
          },
          onCashChange: setCashReceived,
          onCheckout: () => void checkout(),
        }}
        inventory={{
          products,
          onAddProduct: openNewProduct,
          onEditProduct: openEditProduct,
          onAdjustStock: (product, amount) => void adjustStock(product, amount),
        }}
        report={{ sales, revenue, date, onDateChange: setDate }}
        customers={{
          customers,
          customerForm,
          onCustomerFormChange: setCustomerForm,
          onCreateCustomer: (event) => void createCustomer(event),
        }}
        reservations={{
          reservations,
          spaces,
          availableSpaces,
          reservationForm,
          onReservationFormChange: setReservationForm,
          onCreateReservation: (event) => void createReservation(event),
        }}
      />

      <ProductEditorModal
        open={menuEditorOpen}
        editingProductId={editingProductId}
        form={productForm}
        products={products}
        photoPreview={photoPreview}
        onClose={() => setMenuEditorOpen(false)}
        onSave={(event) => void saveProduct(event)}
        onFormChange={setProductForm}
        onPhotoChange={(file) => {
          setPhotoFile(file);
          setPhotoPreview(file ? URL.createObjectURL(file) : null);
        }}
      />

      <ReceiptModal
        open={receiptModalOpen}
        receipt={receiptData}
        paperWidth={paperWidth}
        printing={printing}
        onClose={() => setReceiptModalOpen(false)}
        onPaperWidthChange={setPaperWidth}
        onPrintUSB={() => void handlePrintUSB()}
        onPrintBluetooth={() => void handlePrintBluetooth()}
        onPrintBrowser={handlePrintBrowser}
      />
    </Space>
  );
}
