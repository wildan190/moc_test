/**
 * ESC/POS Thermal Printer Driver for WebUSB & Web Bluetooth
 * Supports standard 58mm and 80mm thermal receipt printers.
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

export interface ReceiptData {
  receiptNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
  customerName?: string;
  date: string;
  paperWidth?: "58mm" | "80mm"; // default 58mm (32 chars)
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export class EscPosEncoder {
  private buffer: number[] = [];
  private maxChars: number;

  constructor(paperWidth: "58mm" | "80mm" = "58mm") {
    // 58mm printers typically have 32 characters per line (Font A).
    // 80mm printers have 48 characters per line.
    this.maxChars = paperWidth === "80mm" ? 48 : 32;
    this.initialize();
  }

  initialize() {
    this.buffer.push(ESC, 0x40); // ESC @ (Initialize printer)
    return this;
  }

  align(alignment: "left" | "center" | "right") {
    const val = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.buffer.push(ESC, 0x61, val);
    return this;
  }

  bold(enabled: boolean) {
    this.buffer.push(ESC, 0x45, enabled ? 1 : 0);
    return this;
  }

  doubleSize(enabled: boolean) {
    // GS ! n (0x11 = double height + width, 0x00 = normal)
    this.buffer.push(GS, 0x21, enabled ? 0x11 : 0x00);
    return this;
  }

  text(str: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  line(str: string = "") {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  divider(char: string = "-") {
    this.align("left");
    this.bold(false);
    this.doubleSize(false);
    this.line(char.repeat(this.maxChars));
    return this;
  }

  row(left: string, right: string) {
    const available = this.maxChars - left.length;
    const spaces = Math.max(1, available - right.length);
    this.line(left + " ".repeat(spaces) + right);
    return this;
  }

  feed(lines: number = 3) {
    this.buffer.push(ESC, 0x64, lines);
    return this;
  }

  cut() {
    // GS V 65 0 (Full cut with feed)
    this.buffer.push(GS, 0x56, 0x41, 0x00);
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

function formatRp(num: number): string {
  return `Rp ${Number(num || 0).toLocaleString("id-ID")}`;
}

/**
 * Builds standard ESC/POS receipt byte stream from ReceiptData
 */
export function buildThermalReceipt(data: ReceiptData): Uint8Array {
  const encoder = new EscPosEncoder(data.paperWidth || "58mm");

  // Header
  encoder
    .align("center")
    .bold(true)
    .doubleSize(true)
    .line("PADA RESTO")
    .doubleSize(false)
    .bold(false)
    .line("Outlet Jakarta")
    .line(data.receiptNumber)
    .line(data.date);

  if (data.customerName) {
    encoder.line(`Pelanggan: ${data.customerName}`);
  }

  encoder.divider("=");

  // Items
  encoder.align("left");
  for (const item of data.items) {
    encoder.line(item.name);
    encoder.row(
      `  ${item.quantity} x ${formatRp(item.price)}`,
      formatRp(item.lineTotal)
    );
  }

  encoder.divider("-");

  // Totals
  encoder.row("Subtotal:", formatRp(data.subtotal));
  if (data.discount > 0) {
    encoder.row("Diskon:", `-${formatRp(data.discount)}`);
  }

  encoder.divider("-");
  encoder.bold(true).row("TOTAL:", formatRp(data.total)).bold(false);

  encoder.divider("-");

  // Payment Breakdown
  encoder.row("Metode Bayar:", data.paymentMethod.toUpperCase());
  if (data.paymentMethod === "tunai") {
    encoder.row("Tunai Diterima:", formatRp(data.cashReceived));
    encoder
      .bold(true)
      .row("KEMBALIAN:", formatRp(data.change))
      .bold(false);
  }

  encoder.divider("=");

  // Footer
  encoder
    .align("center")
    .line("Terima kasih atas kunjungan Anda!")
    .line("Simpan struk ini sebagai bukti pembayaran.")
    .feed(3)
    .cut();

  return encoder.getBytes();
}

/**
 * Print directly via WebUSB API
 */
export async function printViaUSB(receiptBytes: Uint8Array): Promise<void> {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error(
      "WebUSB tidak didukung di browser ini. Harap gunakan Google Chrome atau Microsoft Edge."
    );
  }

  // Request any USB device from user dialog
  const device = await nav.usb.requestDevice({ filters: [] });
  await device.open();

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Find printer interface (Interface class 7 is printer) or first interface
  const iface =
    device.configuration.interfaces.find((i: any) =>
      i.alternates.some((a: any) => a.interfaceClass === 7)
    ) || device.configuration.interfaces[0];

  const interfaceNumber = iface.interfaceNumber;
  await device.claimInterface(interfaceNumber);

  const alternate = iface.alternates[0];
  const endpoint = alternate.endpoints.find(
    (e: any) => e.direction === "out"
  );

  if (!endpoint) {
    await device.releaseInterface(interfaceNumber);
    await device.close();
    throw new Error(
      "Endpoint OUT (pengiriman data) tidak ditemukan pada printer USB ini."
    );
  }

  // Send receipt bytes to printer
  await device.transferOut(endpoint.endpointNumber, receiptBytes);

  // Clean up
  await device.releaseInterface(interfaceNumber);
  await device.close();
}

/**
 * Print directly via Web Bluetooth API (BLE)
 */
export async function printViaBluetooth(
  receiptBytes: Uint8Array
): Promise<void> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error(
      "Web Bluetooth tidak didukung di browser ini. Harap aktifkan Bluetooth dan gunakan Google Chrome (Android/Windows/Mac)."
    );
  }

  // Common Bluetooth thermal printer GATT service UUIDs
  const commonServices = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000fee7-0000-1000-8000-00805f9b34fb",
  ];

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: commonServices,
  });

  const server = await device.gatt.connect();

  let targetCharacteristic: any = null;

  // Search through available services to find writable characteristic
  for (const serviceUuid of commonServices) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (
          char.properties.write ||
          char.properties.writeWithoutResponse
        ) {
          targetCharacteristic = char;
          break;
        }
      }
      if (targetCharacteristic) break;
    } catch {
      // Continue to next service UUID
    }
  }

  // If common services not matched, iterate all primary services
  if (!targetCharacteristic) {
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (
            char.properties.write ||
            char.properties.writeWithoutResponse
          ) {
            targetCharacteristic = char;
            break;
          }
        }
        if (targetCharacteristic) break;
      }
    } catch {
      // ignore
    }
  }

  if (!targetCharacteristic) {
    device.gatt.disconnect();
    throw new Error(
      "Tidak dapat menemukan saluran cetak (GATT Characteristic) pada perangkat Bluetooth ini."
    );
  }

  // Send bytes in safe chunks (512 bytes or 100 bytes) to prevent buffer overflow
  const chunkSize = 100;
  for (let offset = 0; offset < receiptBytes.length; offset += chunkSize) {
    const chunk = receiptBytes.slice(offset, offset + chunkSize);
    if (targetCharacteristic.properties.writeWithoutResponse) {
      await targetCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await targetCharacteristic.writeValue(chunk);
    }
    // Small delay between chunks for hardware buffer handling
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  device.gatt.disconnect();
}

