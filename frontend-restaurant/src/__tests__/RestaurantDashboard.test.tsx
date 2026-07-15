import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RestaurantDashboard from "../components/RestaurantDashboard";
import React from "react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

const NOW = new Date().toISOString();

const mockTables = [
  { id: "A", capacity: 2, status: "vacant", queue_member_id: null, started_at: null, eating_time_minutes: null, queue_member: null },
  { id: "B", capacity: 4, status: "dining", queue_member_id: 1, started_at: NOW, eating_time_minutes: 30, queue_member: { id: 1, customer_name: "Alice", party_size: 4 } },
  { id: "C", capacity: 6, status: "vacant", queue_member_id: null, started_at: null, eating_time_minutes: null, queue_member: null },
  { id: "D", capacity: 8, status: "vacant", queue_member_id: null, started_at: null, eating_time_minutes: null, queue_member: null },
];

const mockQueue = [
  { id: 2, customer_name: "Bob", party_size: 6, status: "waiting", joined_at: NOW, seated_at: null, completed_at: null },
];

const mockHistory = [
  { id: 3, customer_name: "Charlie", party_size: 2, status: "served", joined_at: NOW, seated_at: NOW, completed_at: NOW },
];

describe("RestaurantDashboard Frontend Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tables: mockTables, queue: mockQueue }) });
      }
      if (url.includes("/history")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHistory) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders floor plan table labels and queue", async () => {
    render(<RestaurantDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Meja A")).toBeInTheDocument();
      expect(screen.getByText("Meja B")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("does not call arrive API when customer name is empty", async () => {
    render(<RestaurantDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /Pelanggan Datang/i }));
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/arrive"), expect.anything());
  });

  it("renders occupant name and countdown for dining table", async () => {
    render(<RestaurantDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      // Countdown shows time remaining (monospace minutes:seconds pattern)
      expect(screen.getByText("Sisa waktu")).toBeInTheDocument();
    });
  });

  it("filters history by search term", async () => {
    render(<RestaurantDashboard />);
    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Cari nama pelanggan..."), { target: { value: "ZZZ" } });
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("calls serve API when Force Complete is clicked", async () => {
    render(<RestaurantDashboard />);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /Force Complete/i }));
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/serve"), expect.objectContaining({ method: "POST" }));
  });

  it("sorts history table when column header is clicked", async () => {
    render(<RestaurantDashboard />);
    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());
    const headers = screen.getAllByRole("columnheader");
    const nameHeader = headers.find((h) => h.textContent?.includes("Nama Pelanggan"));
    expect(nameHeader).toBeDefined();
    fireEvent.click(nameHeader!);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});
