import { defineStore } from "pinia";
import { ref } from "vue";

import { connectSocket, getSocket } from "../socket/client";
import { SOCKET_EVENTS } from "../constants/socket-events";
import { useStaffOrdersStore } from "./staff-orders.store";

export const useStaffSocketStore = defineStore("staffSocket", () => {
  const connected = ref(false);
  let initialized = false;

  function init(): void {
    if (initialized) {
      connectSocket();
      return;
    }
    initialized = true;

    const socket = getSocket();

    socket.on("connect", () => {
      connected.value = true;
    });

    socket.on("disconnect", () => {
      connected.value = false;
    });

    const refetch = () => {
      const staffOrdersStore = useStaffOrdersStore();
      void staffOrdersStore.refetchCurrentFilters();
    };

    for (const eventName of [
      SOCKET_EVENTS.ORDER_CREATED,
      SOCKET_EVENTS.ORDER_ACCEPTED,
      SOCKET_EVENTS.ORDER_REJECTED,
      SOCKET_EVENTS.ORDER_STATUS_UPDATED,
      SOCKET_EVENTS.ORDER_CANCELLED,
      SOCKET_EVENTS.ORDER_PAYMENT_UPDATED,
      SOCKET_EVENTS.ORDER_COMPLETED,
      SOCKET_EVENTS.TABLE_OCCUPIED,
      SOCKET_EVENTS.TABLE_RELEASED,
      SOCKET_EVENTS.GUEST_SESSION_EXPIRED,
      SOCKET_EVENTS.GUEST_SESSION_CLOSED,
      SOCKET_EVENTS.GUEST_SESSION_FORCE_CLOSED,
    ]) {
      socket.on(eventName, refetch);
    }

    connectSocket();
  }

  return { connected, init };
});
