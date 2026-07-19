import { money, toMoneyString } from "../../utils/money.js";
import {
  ensureCafeSettings,
  findCafeSettings,
  updateCafeSettings,
} from "./settings.repository.js";
import type { SafeCafeSettings } from "./settings.types.js";
import type { UpdateCafeSettingsInput } from "./settings.validation.js";

function toSafeSettings(settings: {
  taxRatePercent: { toString(): string };
  serviceChargePercent: { toString(): string };
  updatedAt: Date;
}): SafeCafeSettings {
  return {
    taxRatePercent: toMoneyString(settings.taxRatePercent.toString()),
    serviceChargePercent: toMoneyString(
      settings.serviceChargePercent.toString(),
    ),
    updatedAt: settings.updatedAt,
  };
}

export async function getCafeSettingsRecord() {
  const existing = await findCafeSettings();
  const settings = existing ?? (await ensureCafeSettings());
  return toSafeSettings(settings);
}

export async function updateCafeSettingsRecord(input: UpdateCafeSettingsInput) {
  await ensureCafeSettings();

  const updated = await updateCafeSettings({
    ...(input.taxRatePercent !== undefined && {
      taxRatePercent: money(input.taxRatePercent),
    }),
    ...(input.serviceChargePercent !== undefined && {
      serviceChargePercent: money(input.serviceChargePercent),
    }),
  });

  return toSafeSettings(updated);
}

/** Rates used when computing order totals (creates singleton if missing). */
export async function getCafeChargeRates() {
  const settings = (await findCafeSettings()) ?? (await ensureCafeSettings());

  return {
    taxRatePercent: money(settings.taxRatePercent),
    serviceChargePercent: money(settings.serviceChargePercent),
  };
}
