import type { Request, Response } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import {
  getCafeSettingsRecord,
  updateCafeSettingsRecord,
} from "./settings.service.js";
import type { UpdateCafeSettingsInput } from "./settings.validation.js";

export async function get(_request: Request, response: Response) {
  const settings = await getCafeSettingsRecord();
  return sendSuccess(response, {
    message: "Cafe settings retrieved successfully.",
    data: { settings },
  });
}

export async function update(request: Request, response: Response) {
  const settings = await updateCafeSettingsRecord(
    request.body as UpdateCafeSettingsInput,
  );
  return sendSuccess(response, {
    message: "Cafe settings updated successfully.",
    data: { settings },
  });
}
