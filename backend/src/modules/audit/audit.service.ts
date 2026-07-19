import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";

export const AUDIT_ACTIONS = {
  ORDER_ACCEPTED: "ORDER_ACCEPTED",
  ORDER_REJECTED: "ORDER_REJECTED",
  ORDER_STATUS_TRANSITION: "ORDER_STATUS_TRANSITION",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  CUSTOMER_ATTACHED: "CUSTOMER_ATTACHED",
  PAYMENT_CREATED: "PAYMENT_CREATED",
  PAYMENT_REVERSED: "PAYMENT_REVERSED",
  QR_REGENERATED: "QR_REGENERATED",
  RECOVERY_CODE_GENERATED: "RECOVERY_CODE_GENERATED",
  RECOVERY_CODE_REDEEMED: "RECOVERY_CODE_REDEEMED",
  TABLE_RELEASED: "TABLE_RELEASED",
  TABLE_FORCE_RELEASED: "TABLE_FORCE_RELEASED",
  STAFF_ACTIVATED: "STAFF_ACTIVATED",
  STAFF_DEACTIVATED: "STAFF_DEACTIVATED",
  GUEST_SESSION_CLOSED: "GUEST_SESSION_CLOSED",
  GUEST_SESSION_EXPIRED: "GUEST_SESSION_EXPIRED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type AuditInput = {
  action: AuditAction | string;
  actorUserId?: bigint | null;
  actorGuestSessionId?: bigint | null;
  entityType: string;
  entityId: string;
  previousValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const client = input.tx ?? prisma;

  await client.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorGuestSessionId: input.actorGuestSessionId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValues: input.previousValues ?? undefined,
      newValues: input.newValues ?? undefined,
      reason: input.reason ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
