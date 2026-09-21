import {
  SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
} from "@focus-guardian/contracts";

const defaults: ExtensionSettings = {
  apiBaseUrl: import.meta.env.WXT_PUBLIC_API_BASE_URL || "http://localhost:3000",
  accessToken: "",
};

export async function readSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
  return { ...defaults, ...(stored[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined) };
}

export async function updateSettings(update: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await readSettings();
  const next = {
    ...current,
    ...update,
    apiBaseUrl: (update.apiBaseUrl ?? current.apiBaseUrl).replace(/\/$/, ""),
  };
  await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
  return next;
}

