import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

// Mocking window fetch
global.fetch = vi.fn();

// Mocking matchMedia for Ant Design in jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mocking ResizeObserver for ApexCharts / Ant Design
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mocking react-apexcharts for jsdom
vi.mock("react-apexcharts", () => ({
  default: () => React.createElement("div", { "data-testid": "chart" }),
}));

// Mocking WebSocket / usePieSocket
vi.mock("@/lib/usePieSocket", () => ({
  usePieSocket: vi.fn(),
}));

// Mocking sound
vi.mock("@/lib/sound", () => ({
  playChime: vi.fn(),
  speakQueueCall: vi.fn(),
}));
