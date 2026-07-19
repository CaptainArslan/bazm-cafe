import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  createStaffMember,
  getStaffMember,
  listStaffMembers,
  updateStaffMember,
  updateStaffMemberStatus,
} from "./staff.service.js";
import type {
  CreateStaffInput,
  ListStaffQuery,
  UpdateStaffInput,
  UpdateStaffStatusInput,
} from "./staff.validation.js";

export async function list(request: Request, response: Response) {
  const query = request.query as unknown as ListStaffQuery;
  const staff = await listStaffMembers(query);

  return sendSuccess(response, {
    message: "Staff members retrieved successfully.",
    data: {
      staff,
    },
  });
}

export async function getById(request: Request, response: Response) {
  const { staffId } = request.params as { staffId: string };
  const staff = await getStaffMember(staffId);

  return sendSuccess(response, {
    message: "Staff member retrieved successfully.",
    data: {
      staff,
    },
  });
}

export async function create(request: Request, response: Response) {
  const input = request.body as CreateStaffInput;
  const staff = await createStaffMember(input);

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Staff member created successfully.",
    data: {
      staff,
    },
  });
}

export async function update(request: Request, response: Response) {
  const { staffId } = request.params as { staffId: string };
  const input = request.body as UpdateStaffInput;
  const staff = await updateStaffMember(staffId, input);

  return sendSuccess(response, {
    message: "Staff member updated successfully.",
    data: {
      staff,
    },
  });
}

export async function updateStatus(request: Request, response: Response) {
  const { staffId } = request.params as { staffId: string };
  const input = request.body as UpdateStaffStatusInput;
  const staff = await updateStaffMemberStatus(staffId, input);

  return sendSuccess(response, {
    message: "Staff member status updated successfully.",
    data: {
      staff,
    },
  });
}
