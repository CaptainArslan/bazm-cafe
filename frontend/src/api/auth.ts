import { http } from "./http";
import type { AuthSessionResult, SafeUser } from "../types/auth";

export function login(input: { email: string; password: string; deviceName?: string }) {
  return http.post<AuthSessionResult>("/auth/login", input);
}

export function refreshSession() {
  return http.post<AuthSessionResult>("/auth/refresh");
}

export function fetchCurrentUser() {
  return http.get<{ user: SafeUser }>("/auth/me").then((result) => result.user);
}

export function logout() {
  return http.post<void>("/auth/logout");
}

export function logoutAll() {
  return http.post<void>("/auth/logout-all");
}
