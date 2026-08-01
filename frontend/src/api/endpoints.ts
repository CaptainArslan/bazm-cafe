import type { MediaFolder } from "../types/media";

/**
 * Every backend API path, in one place. Change a route here and every
 * caller across `src/api/*.ts` picks it up — nothing else should hardcode a path.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/auth/me",
    logout: "/auth/logout",
    logoutAll: "/auth/logout-all",
  },

  guestMenu: "/guest/menu",

  guestOrders: {
    list: "/guest/orders",
    detail: (orderPublicId: string) => `/guest/orders/${orderPublicId}`,
    receipt: (orderPublicId: string) => `/guest/orders/${orderPublicId}/receipt`,
  },

  guestSessions: {
    resolveTable: "/guest/tables/resolve",
    create: "/guest/sessions",
    current: "/guest/sessions/current",
    close: "/guest/sessions/close",
    recover: "/guest/sessions/recover",
    recoveryCodes: (sessionId: string) => `/guest-sessions/${sessionId}/recovery-codes`,
  },

  settings: "/settings",

  media: {
    upload: (folder: MediaFolder) => `/media?folder=${folder}`,
    delete: "/media",
    list: (folder: MediaFolder) => `/media?folder=${folder}`,
  },

  orders: {
    list: "/orders",
    detail: (orderId: string) => `/orders/${orderId}`,
    accept: (orderId: string) => `/orders/${orderId}/accept`,
    startPreparing: (orderId: string) => `/orders/${orderId}/start-preparing`,
    markReady: (orderId: string) => `/orders/${orderId}/mark-ready`,
    markServed: (orderId: string) => `/orders/${orderId}/mark-served`,
    reject: (orderId: string) => `/orders/${orderId}/reject`,
    cancel: (orderId: string) => `/orders/${orderId}/cancel`,
    attachCustomer: (orderId: string) => `/orders/${orderId}/customer`,
    receipt: (orderId: string) => `/orders/${orderId}/receipt`,
    payments: (orderId: string) => `/orders/${orderId}/payments`,
  },

  customers: {
    list: "/customers",
    detail: (customerId: string) => `/customers/${customerId}`,
  },

  categories: {
    list: "/categories",
    detail: (categoryId: string) => `/categories/${categoryId}`,
    status: (categoryId: string) => `/categories/${categoryId}/status`,
  },

  products: {
    list: "/products",
    detail: (productId: string) => `/products/${productId}`,
    status: (productId: string) => `/products/${productId}/status`,
    stock: (productId: string) => `/products/${productId}/stock`,
  },

  staff: {
    list: "/staff",
    detail: (staffId: string) => `/staff/${staffId}`,
    status: (staffId: string) => `/staff/${staffId}/status`,
    password: (staffId: string) => `/staff/${staffId}/password`,
  },

  tables: {
    list: "/tables",
    detail: (tableId: string) => `/tables/${tableId}`,
    status: (tableId: string) => `/tables/${tableId}/status`,
    qrCode: (tableId: string) => `/tables/${tableId}/qr-code`,
    regenerateQr: (tableId: string) => `/tables/${tableId}/qr-code/regenerate`,
    release: (tableId: string) => `/tables/${tableId}/release`,
    forceRelease: (tableId: string) => `/tables/${tableId}/force-release`,
  },

  payments: {
    list: "/payments",
    detail: (paymentId: string) => `/payments/${paymentId}`,
    reverse: (paymentId: string) => `/payments/${paymentId}/reverse`,
  },
} as const;
