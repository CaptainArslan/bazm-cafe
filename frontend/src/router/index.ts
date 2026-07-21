import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth.store";
import { useGuestSessionStore } from "../stores/guest-session.store";
import type { UserRole } from "../types/auth";

declare module "vue-router" {
  interface RouteMeta {
    role?: UserRole;
    publicOnlyRole?: UserRole;
    requiresSession?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("../layouts/CustomerLayout.vue"),
      children: [
        {
          path: "",
          name: "customer.welcome",
          component: () => import("../views/customer/WelcomeView.vue"),
        },
        {
          path: "scan",
          name: "customer.scan-qr",
          component: () => import("../views/customer/ScanTableQrView.vue"),
        },
        {
          path: "t/:tableToken",
          name: "customer.dine-in-claim",
          component: () => import("../views/customer/DineInClaimView.vue"),
          props: true,
        },
        {
          path: "takeaway",
          name: "customer.takeaway-start",
          component: () => import("../views/customer/TakeawayStartView.vue"),
        },
        {
          path: "recover",
          name: "customer.recovery",
          component: () => import("../views/customer/RecoveryView.vue"),
        },
        {
          path: "menu",
          name: "customer.menu",
          component: () => import("../views/customer/MenuView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "products/:productId",
          name: "customer.product-detail",
          component: () => import("../views/customer/ProductDetailView.vue"),
          props: true,
          meta: { requiresSession: true },
        },
        {
          path: "cart",
          name: "customer.cart",
          component: () => import("../views/customer/CartView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "checkout",
          name: "customer.checkout",
          component: () => import("../views/customer/CheckoutView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "session",
          name: "customer.session",
          component: () => import("../views/customer/SessionView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "orders/:orderId",
          name: "customer.order-detail",
          component: () => import("../views/customer/OrderDetailView.vue"),
          props: true,
          meta: { requiresSession: true },
        },
        {
          path: "session-closed",
          name: "customer.session-closed",
          component: () => import("../views/customer/SessionClosedView.vue"),
        },
      ],
    },
    {
      path: "/staff",
      component: () => import("../layouts/StaffLayout.vue"),
      children: [
        {
          path: "login",
          name: "staff.login",
          component: () => import("../views/staff/LoginView.vue"),
          meta: { publicOnlyRole: "STAFF" },
        },
        {
          path: "",
          name: "staff.home",
          component: () => import("../views/staff/OrderQueueView.vue"),
          meta: { role: "STAFF" },
        },
        {
          path: "orders/:orderId",
          name: "staff.order-detail",
          component: () => import("../views/staff/OrderDetailView.vue"),
          props: true,
          meta: { role: "STAFF" },
        },
        {
          path: "settings",
          name: "staff.settings",
          component: () => import("../views/staff/SettingsView.vue"),
          meta: { role: "STAFF" },
        },
      ],
    },
    {
      path: "/admin",
      component: () => import("../layouts/AdminLayout.vue"),
      children: [
        {
          path: "login",
          name: "admin.login",
          component: () => import("../views/admin/LoginView.vue"),
          meta: { publicOnlyRole: "ADMIN" },
        },
        {
          path: "",
          name: "admin.home",
          component: () => import("../views/admin/DashboardView.vue"),
          meta: { role: "ADMIN" },
        },
        {
          path: "orders",
          name: "admin.orders",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Orders" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "cancellations",
          name: "admin.cancellations",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Cancellations" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "payments",
          name: "admin.payments",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Payments" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "categories",
          name: "admin.categories",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Categories" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "products",
          name: "admin.products",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Products" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "stock",
          name: "admin.stock",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Stock" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "media",
          name: "admin.media",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Media" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "customers",
          name: "admin.customers",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Customers" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "staff",
          name: "admin.staff",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Staff" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "tables",
          name: "admin.tables",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Tables & QR" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "settings",
          name: "admin.settings",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Settings" }),
          meta: { role: "ADMIN" },
        },
      ],
    },
  ],
});

function homeRouteNameFor(role: UserRole): string {
  return role === "ADMIN" ? "admin.home" : "staff.home";
}

function loginRouteNameFor(role: UserRole): string {
  return role === "ADMIN" ? "admin.login" : "staff.login";
}

router.beforeEach(async (to) => {
  if (to.meta.requiresSession === true) {
    const guestSessionStore = useGuestSessionStore();
    await guestSessionStore.ensureFetched();

    if (!guestSessionStore.isActive) {
      return { name: "customer.welcome" };
    }

    return true;
  }

  const requiredRole = to.meta.role;
  const publicOnlyRole = to.meta.publicOnlyRole;

  if (!requiredRole && !publicOnlyRole) {
    return true;
  }

  const authStore = useAuthStore();
  // Only attempt a cookie-based restore when we don't already have a session in memory (e.g. right
  // after login()): login() doesn't touch `status`, so guarding on status alone would re-trigger
  // restore() on the very next navigation and risk clobbering a freshly-set session if it fails.
  if (!authStore.isAuthenticated && authStore.status === "idle") {
    await authStore.restore();
  }

  if (publicOnlyRole) {
    if (authStore.isAuthenticated && authStore.role === publicOnlyRole) {
      return { name: homeRouteNameFor(publicOnlyRole) };
    }
    return true;
  }

  if (!requiredRole) {
    return true;
  }

  if (!authStore.isAuthenticated) {
    return {
      name: loginRouteNameFor(requiredRole),
      query: to.fullPath !== "/" ? { redirect: to.fullPath } : undefined,
    };
  }

  if (authStore.role !== requiredRole) {
    return { name: homeRouteNameFor(authStore.role as UserRole) };
  }

  return true;
});

export default router;
