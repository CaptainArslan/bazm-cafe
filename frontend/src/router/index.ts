import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "customer.home",
      component: () => import("../views/customer/HomePlaceholder.vue"),
    },
    {
      path: "/staff",
      name: "staff.home",
      component: () => import("../views/staff/HomePlaceholder.vue"),
    },
    {
      path: "/admin",
      name: "admin.home",
      component: () => import("../views/admin/HomePlaceholder.vue"),
    },
  ],
});

export default router;
