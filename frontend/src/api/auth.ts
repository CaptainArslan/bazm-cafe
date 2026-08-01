import { endpoints } from "./endpoints";
import { authHttp, http } from "./http";
import type { AuthSessionResult, SafeUser } from "../types/auth";

export function login(input: { email: string; password: string; deviceName?: string }) {
  return http.post<AuthSessionResult>(endpoints.auth.login, input);
}

export function refreshSession() {
  return http.post<AuthSessionResult>(endpoints.auth.refresh);
}

export function fetchCurrentUser() {
  return authHttp.get<{ user: SafeUser }>(endpoints.auth.me).then((result) => result.user);
}

export function logout() {
  return authHttp.post<void>(endpoints.auth.logout);
}

export function logoutAll() {
  return authHttp.post<void>(endpoints.auth.logoutAll);
}
