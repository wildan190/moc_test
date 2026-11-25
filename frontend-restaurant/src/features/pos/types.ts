export type Product = {
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

export type Outlet = { id: string; name: string; address?: string };

export type Customer = {
  id: number;
  name: string;
  phone: string;
  points: number;
  total_spent: number;
};

export type Sale = {
  id: number;
  receipt_number: string;
  payment_method: string;
  total: number;
  discount: number;
  created_at: string;
};

export type Reservation = {
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

export type ReservationSpace = { id: number; name: string; capacity: number };
export type CartLine = { product: Product; quantity: number };

export type ReceiptData = {
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
};

export type ProductForm = {
  name: string;
  barcode: string;
  category: string;
  price: string;
  stock: string;
  is_bundle: boolean;
  bundle_product_ids: number[];
};

export type CustomerForm = { name: string; phone: string };

export type ReservationForm = {
  customer_name: string;
  phone: string;
  party_size: string;
  reservation_date: string;
  start_time: string;
  space_id: string;
  notes: string;
};
