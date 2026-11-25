import { Button, Modal, Radio, Space, Tag, Typography } from "antd";
import {
  CheckCircleOutlined,
  PrinterOutlined,
  UsbOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import type { ReceiptData } from "../types";
import { money } from "../utils";

const { Text } = Typography;

type ReceiptModalProps = {
  open: boolean;
  receipt: ReceiptData | null;
  paperWidth: "58mm" | "80mm";
  printing: boolean;
  onClose: () => void;
  onPaperWidthChange: (width: "58mm" | "80mm") => void;
  onPrintUSB: () => void;
  onPrintBluetooth: () => void;
  onPrintBrowser: () => void;
};

export default function ReceiptModal({
  open,
  receipt,
  paperWidth,
  printing,
  onClose,
  onPaperWidthChange,
  onPrintUSB,
  onPrintBluetooth,
  onPrintBrowser,
}: ReceiptModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={[
        <Button
          key="usb"
          icon={<UsbOutlined />}
          loading={printing}
          onClick={onPrintUSB}
          type="primary"
          style={{ background: "#1677ff" }}
        >
          Cetak USB
        </Button>,
        <Button
          key="bt"
          icon={<WifiOutlined />}
          loading={printing}
          onClick={onPrintBluetooth}
          type="primary"
          style={{ background: "#722ed1", borderColor: "#722ed1" }}
        >
          Cetak Bluetooth
        </Button>,
        <Button
          key="browser"
          icon={<PrinterOutlined />}
          onClick={onPrintBrowser}
        >
          Browser / PDF
        </Button>,
        <Button key="close" onClick={onClose}>
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
      {receipt && (
        <div style={{ marginTop: 8 }}>
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
              onChange={(event) => onPaperWidthChange(event.target.value)}
            >
              <Radio.Button value="58mm">58mm (Standar)</Radio.Button>
              <Radio.Button value="80mm">80mm</Radio.Button>
            </Radio.Group>
          </div>

          {receipt.paymentMethod === "tunai" && receipt.change > 0 && (
            <div
              style={{
                background: "#f6ffed",
                border: "2px dashed #52c41a",
                borderRadius: 10,
                padding: 16,
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
                {money(receipt.change)}
              </div>
              <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 6 }}>
                Total: {money(receipt.total)} • Tunai Diterima:{" "}
                {money(receipt.cashReceived)}
              </div>
            </div>
          )}

          <div
            id="printable-pos-receipt"
            style={{
              background: "#fafafa",
              border: "1px solid #e8e8e8",
              borderRadius: 8,
              padding: 16,
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
                {receipt.receiptNumber}
              </div>
              <div style={{ color: "#8c8c8c", fontSize: 11 }}>
                {receipt.date}
              </div>
              {receipt.customerName && (
                <div style={{ color: "#1677ff", marginTop: 2 }}>
                  Pelanggan: {receipt.customerName}
                </div>
              )}
            </div>

            <div
              style={{
                borderBottom: "1px dashed #d9d9d9",
                paddingBottom: 10,
                marginBottom: 10,
              }}
            >
              {receipt.items.map((item, index) => (
                <div
                  key={index}
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

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Subtotal</Text>
                <span>{money(receipt.subtotal)}</span>
              </div>
              {receipt.discount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#52c41a",
                  }}
                >
                  <span>Diskon</span>
                  <span>- {money(receipt.discount)}</span>
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
                <span style={{ color: "#1677ff" }}>{money(receipt.total)}</span>
              </div>

              <div
                style={{
                  borderTop: "1px dashed #d9d9d9",
                  paddingTop: 8,
                  marginTop: 6,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text type="secondary">Metode Bayar</Text>
                  <Tag
                    color="blue"
                    style={{ textTransform: "uppercase", margin: 0 }}
                  >
                    {receipt.paymentMethod}
                  </Tag>
                </div>
                {receipt.paymentMethod === "tunai" && (
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
                        {money(receipt.cashReceived)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: "bold",
                        color: receipt.change > 0 ? "#52c41a" : undefined,
                        marginTop: 4,
                      }}
                    >
                      <span>Kembalian</span>
                      <span style={{ fontSize: 14 }}>
                        {money(receipt.change)}
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
  );
}
