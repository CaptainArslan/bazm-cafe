import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
  closeGuestSession,
  createGuestSession,
  getCurrentGuestSession,
  recoverGuestSession,
  resolveTable,
} from "../api/guest-sessions";
import { ApiError } from "../api/http";
import { CustomerType } from "../types/enums";
import type { ResolvedTable, SafeGuestSession } from "../types/session";

export const useGuestSessionStore = defineStore("guestSession", () => {
  const session = ref<SafeGuestSession | null>(null);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const hasFetched = ref(false);

  const isActive = computed(() => session.value?.isActive === true);
  const isDineIn = computed(() => session.value?.orderType === CustomerType.DINE_IN);
  const isTakeaway = computed(() => session.value?.orderType === CustomerType.TAKEAWAY);

  async function fetchCurrent(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await getCurrentGuestSession();
      session.value = result.session;
    } catch (caught) {
      session.value = null;
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
      hasFetched.value = true;
    }
  }

  async function ensureFetched(): Promise<void> {
    if (!hasFetched.value) {
      await fetchCurrent();
    }
  }

  async function resolveDineInTable(tableToken: string): Promise<ResolvedTable> {
    const result = await resolveTable(tableToken);
    return result.table;
  }

  async function startDineIn(tableToken: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await createGuestSession({
        orderType: CustomerType.DINE_IN,
        tableToken,
      });
      session.value = result.session;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function startTakeaway(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await createGuestSession({ orderType: CustomerType.TAKEAWAY });
      session.value = result.session;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function recover(recoveryCode: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await recoverGuestSession(recoveryCode);
      session.value = result.session;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function endSession(): Promise<{ receiptAccessExpiresAt: string | null }> {
    const result = await closeGuestSession();
    session.value = result.session;
    return { receiptAccessExpiresAt: result.receiptAccessExpiresAt };
  }

  function clear(): void {
    session.value = null;
    error.value = null;
  }

  return {
    session,
    loading,
    error,
    hasFetched,
    isActive,
    isDineIn,
    isTakeaway,
    fetchCurrent,
    ensureFetched,
    resolveDineInTable,
    startDineIn,
    startTakeaway,
    recover,
    endSession,
    clear,
  };
});
