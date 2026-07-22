<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth.store";

type NavItem = { label: string; routeName: string };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ label: "Dashboard", routeName: "admin.home" }] },
  {
    label: "Operations",
    items: [
      { label: "Orders", routeName: "admin.orders" },
      { label: "Cancellations", routeName: "admin.cancellations" },
      { label: "Payments", routeName: "admin.payments" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Categories", routeName: "admin.categories" },
      { label: "Products", routeName: "admin.products" },
      { label: "Stock", routeName: "admin.stock" },
      { label: "Media", routeName: "admin.media" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Customers", routeName: "admin.customers" },
      { label: "Staff", routeName: "admin.staff" },
    ],
  },
  {
    label: null,
    items: [
      { label: "Tables & QR", routeName: "admin.tables" },
      { label: "Settings", routeName: "admin.settings" },
    ],
  },
];

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isDrawerOpen = ref(false);

function closeDrawer(): void {
  isDrawerOpen.value = false;
}

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "admin.login" });
}
</script>

<template>
  <div
    class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900"
    :class="{ 'md:flex': authStore.isAuthenticated }"
  >
    <template v-if="authStore.isAuthenticated">
      <div class="flex items-center justify-between border-b border-bz-border bg-white px-4 py-2 md:hidden">
        <span class="text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Admin</span>
        <button
          type="button"
          data-test="nav-drawer-toggle"
          class="text-sm font-medium text-bz-ink-700"
          @click="isDrawerOpen = !isDrawerOpen"
        >
          Menu
        </button>
      </div>

      <div
        v-if="isDrawerOpen"
        data-test="nav-drawer-backdrop"
        class="fixed inset-0 z-20 bg-black/30 md:hidden"
        @click="closeDrawer"
      />

      <aside
        data-test="nav-sidebar"
        class="fixed inset-y-0 left-0 z-30 w-64 -translate-x-full overflow-y-auto border-r border-bz-border bg-white px-4 py-5 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0"
        :class="{ 'translate-x-0': isDrawerOpen }"
      >
        <p class="px-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Admin</p>

        <nav class="mt-4 flex flex-col gap-4">
          <div v-for="(group, index) in NAV_GROUPS" :key="index">
            <p v-if="group.label" class="px-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-300">
              {{ group.label }}
            </p>
            <div class="mt-1 flex flex-col gap-0.5">
              <RouterLink
                v-for="item in group.items"
                :key="item.routeName"
                :to="{ name: item.routeName }"
                :data-test="`nav-link-${item.routeName}`"
                class="rounded-lg px-2 py-1.5 text-sm font-medium"
                :class="
                  route.name === item.routeName
                    ? 'bg-bz-gold-100 text-bz-gold-800'
                    : 'text-bz-ink-700 hover:bg-bz-ink-100'
                "
                @click="closeDrawer"
              >
                {{ item.label }}
              </RouterLink>
            </div>
          </div>
        </nav>

        <button
          type="button"
          data-test="sign-out"
          class="mt-6 w-full rounded-full border border-bz-border px-4 py-2 text-sm font-medium text-bz-ink-700"
          @click="onLogout"
        >
          Sign out
        </button>
      </aside>
    </template>

    <main :class="authStore.isAuthenticated ? 'min-w-0 flex-1' : ''">
      <RouterView />
    </main>
  </div>
</template>
