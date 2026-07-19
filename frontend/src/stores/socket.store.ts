import { defineStore } from "pinia";
import { ref } from "vue";

import { connectSocket, disconnectSocket, getSocket } from "../socket/client";
import { SOCKET_EVENTS } from "../constants/socket-events";
import { useGuestSessionStore } from "./guest-session.store";
import { useOrdersStore } from "./orders.store";

export const useSocketStore = defineStore("socket", () => {
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

    const refetchOrdersAndSession = () => {
      const ordersStore = useOrdersStore();
      const guestSessionStore = useGuestSessionStore();
      void ordersStore.fetchOrders();
      void guestSessionStore.fetchCurrent();
    };

    for (const eventName of [
      SOCKET_EVENTS.ORDER_CREATED,
      SOCKET_EVENTS.ORDER_ACCEPTED,
      SOCKET_EVENTS.ORDER_REJECTED,
      SOCKET_EVENTS.ORDER_STATUS_UPDATED,
      SOCKET_EVENTS.ORDER_CANCELLED,
      SOCKET_EVENTS.ORDER_PAYMENT_UPDATED,
      SOCKET_EVENTS.ORDER_COMPLETED,
      SOCKET_EVENTS.GUEST_SESSION_EXPIRED,
      SOCKET_EVENTS.GUEST_SESSION_CLOSED,
      SOCKET_EVENTS.GUEST_SESSION_FORCE_CLOSED,
    ]) {
      socket.on(eventName, refetchOrdersAndSession);
    }

    connectSocket();
  }

  function teardown(): void {
    disconnectSocket();
    connected.value = false;
  }

  return { connected, init, teardown };
});
