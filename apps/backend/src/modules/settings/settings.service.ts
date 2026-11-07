import { settingsRepository } from "./settings.repository";
import { auditService } from "../../services/audit.service";
import { SETTINGS_KEYS } from "@idm/shared-types";
import type { UpdateSettingsInput } from "@idm/shared-validation";
import type { AppSettings } from "@idm/shared-types";

/**
 * Defaults used when a key has never been saved yet — this is what a
 * brand-new install (or the production template database) sees before
 * anyone opens the Settings page.
 */
const DEFAULTS: AppSettings = {
  STORE_NAME_AR: "إسلام للألبان والأجبان",
  STORE_PHONE: "",
  STORE_ADDRESS: "",
  CURRENCY: "USD",
  INVOICE_PREFIX: "INV",
  INVOICE_FOOTER_NOTE: "شكراً لتعاملكم معنا",
  DEFAULT_MIN_STOCK_ALERT: 0,
  LOW_STOCK_ALERTS_ENABLED: true,
  DEBT_ALERT_THRESHOLD: 0,
};

function parseValue(key: SettingsKey, raw: string | undefined): AppSettings[SettingsKey] {
  if (raw === undefined) return DEFAULTS[key];
  if (key === "DEFAULT_MIN_STOCK_ALERT" || key === "DEBT_ALERT_THRESHOLD") {
    const parsed = Number(raw);
    return (Number.isFinite(parsed) ? parsed : DEFAULTS[key]) as AppSettings[typeof key];
  }
  if (key === "LOW_STOCK_ALERTS_ENABLED") {
    return (raw === "true") as AppSettings[typeof key];
  }
  return raw as AppSettings[typeof key];
}

type SettingsKey = keyof AppSettings;

export const settingsService = {
  async getAll(): Promise<AppSettings> {
    const rows = await settingsRepository.findAll();
    const rawByKey = new Map(rows.map((r) => [r.key, r.value]));

    const result = {} as AppSettings;
    for (const key of Object.values(SETTINGS_KEYS) as SettingsKey[]) {
      result[key] = parseValue(key, rawByKey.get(key)) as never;
    }
    return result;
  },

  async update(input: UpdateSettingsInput, actorUserId: string): Promise<AppSettings> {
    const before = await this.getAll();

    const entries = Object.entries(input).filter(([, value]) => value !== undefined) as Array<
      [SettingsKey, string | number | boolean]
    >;

    if (entries.length > 0) {
      await settingsRepository.upsertMany(entries.map(([key, value]) => ({ key, value: String(value) })));
    }

    const after = await this.getAll();

    await auditService.log({
      userId: actorUserId,
      action: "UPDATE_SETTINGS",
      entityType: "ApplicationSettings",
      oldValue: before,
      newValue: after,
    });

    return after;
  },
};
