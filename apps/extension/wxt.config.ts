import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Focus Guardian",
    description: "A goal-locked Pomodoro timer that adds friction to distracting pages.",
    permissions: ["storage", "alarms"],
    host_permissions: ["http://localhost:3000/*"],
    incognito: "not_allowed",
  },
});
