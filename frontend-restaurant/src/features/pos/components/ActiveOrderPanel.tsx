import {
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
} from "antd";
import { MinusOutlined, PlusOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import type { CartLine, Customer, Product } from "../types";
import { money } from "../utils";

const { Text } = Typography;

export type ActiveOrderPanelProps = {
  cart: CartLine[];
  customers: Customer[];
  customerId: string;
  subtotal: number;
  discount: number;
  payment: string;
  cashReceived: number | null;
  total: number;
  change: number;
  isUnderpaid: boolean;
  quickCashOptions: number[];
  busy: boolean;
  onClearCart: () => void;
  onDecreaseItem: (productId: number) => void;
  onAddToCart: (product: Product) => void;
  onCustomerChange: (customerId: string) => void;
  onDiscountChange: (discount: number) => void;
  onPaymentChange: (payment: string) => void;
  onCashChange: (amount: number | null) => void;
  onCheckout: () => void;
};

export default function ActiveOrderPanel({
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
  onClearCart,
  onDecreaseItem,
  onAddToCart,
  onCustomerChange,
  onDiscountChange,
  onPaymentChange,
  onCashChange,
  onCheckout,
}: ActiveOrderPanelProps) {
  return (
    <Card
      title={
        <Space>
          <ShoppingCartOutlined style={{ color: "#1677ff" }} />
          <span>Pesanan Aktif</span>
          <Badge
            count={cart.reduce((sum, item) => sum + item.quantity, 0)}
            style={{ backgroundColor: "#1677ff" }}
          />
        </Space>
      }
      extra={
        cart.length > 0 && (
          <Button type="link" danger size="small" onClick={onClearCart}>
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
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 92px minmax(100px, max-content)",
                columnGap: 8,
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Text strong style={{ fontSize: 13 }}>
                  {item.product.name}
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {money(item.product.price)}
                  </Text>
                </div>
              </div>

              <Space
                size={4}
                align="center"
                style={{ justifySelf: "center" }}
              >
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => onDecreaseItem(item.product.id)}
                />
                <Text
                  strong
                  style={{
                    display: "inline-block",
                    width: 24,
                    textAlign: "center",
                  }}
                >
                  {item.quantity}
                </Text>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => onAddToCart(item.product)}
                />
              </Space>

              <Text
                strong
                style={{
                  minWidth: 100,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {money(item.product.price * item.quantity)}
              </Text>
            </div>
          ))}
        </div>
      )}

      <Divider style={{ margin: "12px 0" }} />

      <Space orientation="vertical" size="small" style={{ width: "100%" }}>
        <div>
          <Text strong style={{ fontSize: 12 }}>
            Pelanggan Loyal (Member)
          </Text>
          <Select
            placeholder="Pilih Pelanggan Umum"
            allowClear
            value={customerId || undefined}
            onChange={(value) => onCustomerChange(value || "")}
            style={{ width: "100%", marginTop: 4 }}
            options={customers.map((customer) => ({
              label: `${customer.name} (${customer.points} Poin)`,
              value: String(customer.id),
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
            onChange={(value) => onDiscountChange(value || 0)}
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
            onChange={(event) => onPaymentChange(event.target.value)}
            style={{ width: "100%", marginTop: 4 }}
          >
            <Radio.Button value="tunai">Tunai</Radio.Button>
            <Radio.Button value="qris">QRIS</Radio.Button>
            <Radio.Button value="kartu">Kartu</Radio.Button>
            <Radio.Button value="transfer">Transfer</Radio.Button>
          </Radio.Group>
        </div>

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
                onClick={() => onCashChange(total)}
                style={{ fontSize: 11 }}
              >
                Uang Pas
              </Button>
            </div>

            <InputNumber
              min={0}
              value={cashReceived ?? undefined}
              placeholder={`Ketik nominal uang (cth: ${money(total)})`}
              onChange={(value) => onCashChange(value ?? null)}
              style={{ width: "100%", marginTop: 6 }}
              prefix="Rp"
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                Number(value?.replace(/\$\s?|(,*)/g, "") || 0)
              }
            />

            {quickCashOptions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {quickCashOptions.map((option) => (
                  <Button
                    key={option}
                    size="small"
                    type={cashReceived === option ? "primary" : "default"}
                    onClick={() => onCashChange(option)}
                    style={{ fontSize: 11 }}
                  >
                    {money(option)}
                  </Button>
                ))}
              </div>
            )}

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
          onClick={onCheckout}
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
  );
}
