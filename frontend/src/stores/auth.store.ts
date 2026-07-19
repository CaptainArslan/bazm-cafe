// frontend/src/stores/auth.store.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { fetchCurrentUser, login as loginRequest, logout as logoutRequest, logoutAll as logoutAllRequest, refreshSession } from "../api/auth";
import { configureAuthIntegration } from "../api/http";
import { emitSessionExpired } from "../lib/session-expired-bus";
import { disconnectSocket } from "../socket/client";
import type { SafeUser, UserRole } from "../types/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<SafeUser | null>(null);
  const accessToken = ref<string | null>(null);
  const status = ref<"idle" | "restoring" | "ready">("idle");

  // setSession()/clearSession() always set or clear user and accessToken together, so user alone is an equivalent signal; accessToken remains relevant only as the bearer-token source for authHttp, not as a second authentication signal.
  const isAuthenticated = computed(() => user.value !== null);
  const role = computed<UserRole | null>(() => user.value?.role ?? null);

  function setSession(nextToken: string, nextUser: SafeUser): void {
    accessToken.value = nextToken;
    user.value = nextUser;
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
  }

  async function login(email: string, password: string, deviceName?: string): Promise<SafeUser> {
    const result = await loginRequest({ email, password, deviceName });
    setSession(result.accessToken, result.user);
    return result.user;
  }

  async function restore(): Promise<void> {
    if (status.value !== "idle") {
      return;
    }
    status.value = "restoring";
    try {
      const result = await refreshSession();
      setSession(result.accessToken, result.user);
    } catch {
      clearSession();
    } finally {
      status.value = "ready";
    }
  }

  async function refreshUser(): Promise<void> {
    if (!isAuthenticated.value) {
      return;
    }
    user.value = await fetchCurrentUser();
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch {
      // Clear client state regardless of network failure, per spec.
    }
    clearSession();
    disconnectSocket();
  }

  async function logoutAll(): Promise<void> {
    try {
      await logoutAllRequest();
    } catch {
      // Clear client state regardless of network failure, per spec.
    }
    clearSession();
    disconnectSocket();
  }

  configureAuthIntegration({
    getToken: () => accessToken.value,
    refresh: async () => {
      try {
        const result = await refreshSession();
        setSession(result.accessToken, result.user);
        return result.accessToken;
      } catch {
        clearSession();
        return null;
      }
    },
    onUnauthorized: () => {
      const wasAuthenticated = isAuthenticated.value;
      clearSession();
      disconnectSocket();
      if (wasAuthenticated) {
        emitSessionExpired();
      }
    },
  });

  return { user, status, isAuthenticated, role, login, restore, refreshUser, logout, logoutAll };
});
