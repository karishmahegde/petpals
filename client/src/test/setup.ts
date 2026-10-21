// Runs before every test file (vite.config.ts test.setupFiles).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import useAuthStore from "../logic/store/useAuthStore";

afterEach(() => {
  // Unmount what the test rendered — automatic only with Vitest globals,
  // which this project doesn't use (tests import describe/test/expect).
  cleanup();
  // A signed-in user must never carry over into the next test.
  useAuthStore.setState({ user: null, token: null, role: null });
  // Absent in a suite that opts into the plain Node environment.
  if (typeof window !== "undefined") window.localStorage.clear();
});
