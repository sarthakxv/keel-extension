import { defineConfig } from "wxt";

const apiBaseUrl = process.env.WXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const apiOrigin = (() => {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
})();

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      port: 4173,
      strictPort: true,
    },
  },
  manifest: {
    name: "Keel",
    description: "A Pomodoro timer that interrupts pages that don't match your goal.",
    permissions: ["storage", "alarms"],
    host_permissions: [`${apiOrigin}/*`],
    incognito: "not_allowed",
  },
});
