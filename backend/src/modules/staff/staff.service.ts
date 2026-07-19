import bcrypt from "bcrypt";

import { env } from "../../config/environment.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";
import { STAFF_MESSAGES } from "./staff.constants.js";
import {
  createStaffUser,
  findStaffByEmail,
  findStaffByUuid,
  listStaff,
  revokeStaffSessions,
  setStaffActiveStatus,
  updateStaffUser,
} from "./staff.repository.js";
import type { SafeStaff } from "./staff.types.js";
import type {
  CreateStaffInput,
  ListStaffQuery,
  UpdateStaffInput,
  UpdateStaffStatusInput,
} from "./staff.validation.js";

function toSafeStaff(user: {
  uuid: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeStaff {
  if (user.role !== UserRole.STAFF) {
    throw new AppError(
      STAFF_MESSAGES.CANNOT_MODIFY_ADMIN,
      HTTP_STATUS.FORBIDDEN,
      "CANNOT_MODIFY_ADMIN",
    );
  }

  return {
    id: user.uuid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: UserRole.STAFF,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listStaffMembers(
  query: ListStaffQuery,
): Promise<SafeStaff[]> {
  const staff = await listStaff({
    ...(query.search !== undefined && {
      search: query.search,
    }),
    ...(query.isActive !== undefined && {
      isActive: query.isActive,
    }),
  });

  return staff.map(toSafeStaff);
}

export async function getStaffMember(staffId: string): Promise<SafeStaff> {
  const staff = await findStaffByUuid(staffId);

  if (staff === null) {
    throw new AppError(
      STAFF_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "STAFF_NOT_FOUND",
    );
  }

  return toSafeStaff(staff);
}

export async function createStaffMember(
  input: CreateStaffInput,
): Promise<SafeStaff> {
  const existing = await findStaffByEmail(input.email);

  if (existing !== null) {
    throw new AppError(
      STAFF_MESSAGES.EMAIL_ALREADY_EXISTS,
      HTTP_STATUS.CONFLICT,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const staff = await createStaffUser({
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash,
  });

  return toSafeStaff(staff);
}

export async function updateStaffMember(
  staffId: string,
  input: UpdateStaffInput,
): Promise<SafeStaff> {
  const staff = await findStaffByUuid(staffId);

  if (staff === null) {
    throw new AppError(
      STAFF_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "STAFF_NOT_FOUND",
    );
  }

  if (input.email !== undefined && input.email !== staff.email) {
    const existing = await findStaffByEmail(input.email);

    if (existing !== null && existing.uuid !== staff.uuid) {
      throw new AppError(
        STAFF_MESSAGES.EMAIL_ALREADY_EXISTS,
        HTTP_STATUS.CONFLICT,
        "EMAIL_ALREADY_EXISTS",
      );
    }
  }

  const passwordHash =
    input.password === undefined
      ? undefined
      : await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const updated = await updateStaffUser(staff.id, {
    ...(input.name !== undefined && {
      name: input.name,
    }),
    ...(input.email !== undefined && {
      email: input.email,
    }),
    ...(input.phone !== undefined && {
      phone: input.phone,
    }),
    ...(passwordHash !== undefined && {
      passwordHash,
    }),
  });

  if (passwordHash !== undefined) {
    await revokeStaffSessions(staff.id);
  }

  return toSafeStaff(updated);
}

export async function updateStaffMemberStatus(
  staffId: string,
  input: UpdateStaffStatusInput,
): Promise<SafeStaff> {
  const staff = await findStaffByUuid(staffId);

  if (staff === null) {
    throw new AppError(
      STAFF_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "STAFF_NOT_FOUND",
    );
  }

  if (staff.isActive === input.isActive) {
    return toSafeStaff(staff);
  }

  const updated = await setStaffActiveStatus(staff.id, input.isActive);

  await writeAuditLog({
    action: input.isActive
      ? AUDIT_ACTIONS.STAFF_ACTIVATED
      : AUDIT_ACTIONS.STAFF_DEACTIVATED,
    entityType: "user",
    entityId: staff.uuid,
    previousValues: { isActive: staff.isActive },
    newValues: { isActive: input.isActive },
  });

  return toSafeStaff(updated);
}
