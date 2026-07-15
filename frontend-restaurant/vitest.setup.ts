import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mocking window fetch
global.fetch = vi.fn();
