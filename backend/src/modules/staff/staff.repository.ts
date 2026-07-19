import { prisma } from "../../config/database.js";
import { UserRole } from "../../generated/prisma/enums.js";

const staffSelect = {
  id: true,
  uuid: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export function findStaffByUuid(uuid: string) {
  return prisma.user.findFirst({
    where: {
      uuid,
      role: UserRole.STAFF,
      deletedAt: null,
    },
    select: staffSelect,
  });
}

export function findStaffByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    select: {
      id: true,
      uuid: true,
      role: true,
    },
  });
}

export function listStaff(filters: {
  search?: string;
  isActive?: boolean;
}) {
  return prisma.user.findMany({
    where: {
      role: UserRole.STAFF,
      deletedAt: null,
      ...(filters.isActive !== undefined && {
        isActive: filters.isActive,
      }),
      ...(filters.search !== undefined && {
        OR: [
          {
            name: {
              contains: filters.search,
            },
          },
          {
            email: {
              contains: filters.search,
            },
          },
          {
            phone: {
              contains: filters.search,
            },
          },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }],
    select: staffSelect,
  });
}

export function createStaffUser(data: {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role: UserRole.STAFF,
      isActive: true,
      passwordChangedAt: new Date(),
    },
    select: staffSelect,
  });
}

export function updateStaffUser(
  userId: bigint,
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    passwordHash?: string;
  },
) {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),
      ...(data.email !== undefined && {
        email: data.email,
      }),
      ...(data.phone !== undefined && {
        phone: data.phone,
      }),
      ...(data.passwordHash !== undefined && {
        passwordHash: data.passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
    },
    select: staffSelect,
  });
}

export async function setStaffActiveStatus(
  userId: bigint,
  isActive: boolean,
) {
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const staff = await transaction.user.update({
      where: {
        id: userId,
      },
      data: {
        isActive,
        ...(!isActive && {
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      },
      select: staffSelect,
    });

    if (!isActive) {
      await transaction.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await transaction.refreshToken.updateMany({
        where: {
          authSession: {
            userId,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
    }

    return staff;
  });
}

export async function revokeStaffSessions(userId: bigint) {
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await transaction.refreshToken.updateMany({
      where: {
        authSession: {
          userId,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });
}
