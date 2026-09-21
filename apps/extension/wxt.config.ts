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
  manifest: {
    name: "Focus Guardian",
    description: "A goal-locked Pomodoro timer that adds friction to distracting pages.",
    permissions: ["storage", "alarms"],
    host_permissions: [`${apiOrigin}/*`],
    incognito: "not_allowed",
  },
});
