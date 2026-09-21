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
    description: "Set a goal. Keel interrupts you when the page isn't that work.",
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
    permissions: ["storage", "alarms"],
    host_permissions: [`${apiOrigin}/*`],
    incognito: "not_allowed",
  },
});
