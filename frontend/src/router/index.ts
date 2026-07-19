import { createRouter, createWebHistory } from "vue-router";

import { useGuestSessionStore } from "../stores/guest-session.store";

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
          path: "",
          name: "staff.home",
          component: () => import("../views/staff/HomePlaceholder.vue"),
        },
      ],
    },
    {
      path: "/admin",
      component: () => import("../layouts/AdminLayout.vue"),
      children: [
        {
          path: "",
          name: "admin.home",
          component: () => import("../views/admin/HomePlaceholder.vue"),
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresSession !== true) {
    return true;
  }

  const guestSessionStore = useGuestSessionStore();
  await guestSessionStore.ensureFetched();

  if (!guestSessionStore.isActive) {
    return { name: "customer.welcome" };
  }

  return true;
});

export default router;
