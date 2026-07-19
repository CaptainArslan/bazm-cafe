export const UserRole = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthSessionResult = {
  accessToken: string;
  user: SafeUser;
};
