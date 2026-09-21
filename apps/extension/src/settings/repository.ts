import {
  SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
} from "@focus-guardian/contracts";

const defaults: ExtensionSettings = {
  apiBaseUrl: import.meta.env.WXT_PUBLIC_API_BASE_URL || "http://localhost:3000",
  installationId: "",
};

export async function readSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
  const current = {
    ...defaults,
    ...(stored[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined),
  };
  if (current.installationId) return current;
  const next = { ...current, installationId: crypto.randomUUID() };
  await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
  return next;
}
