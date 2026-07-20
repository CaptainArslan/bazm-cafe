<!-- frontend/src/components/domain/CustomerAttachPanel.vue -->
<script setup lang="ts">
import { ref } from "vue";

import { useStaffCustomersStore } from "../../stores/staff-customers.store";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";

const props = defineProps<{ orderId: string }>();
const emit = defineEmits<{ attached: [] }>();

const staffCustomersStore = useStaffCustomersStore();
const staffOrdersStore = useStaffOrdersStore();

const query = ref("");
const showNewCustomerForm = ref(false);
const newName = ref("");
const newPhone = ref("");
const attaching = ref(false);

async function onSearchInput(): Promise<void> {
  await staffCustomersStore.search(query.value);
}

async function attachExisting(customerId: string): Promise<void> {
  attaching.value = true;
  try {
    await staffOrdersStore.attachCustomer(props.orderId, { customerId });
    emit("attached");
  } finally {
    attaching.value = false;
  }
}

async function attachNew(): Promise<void> {
  if (!newName.value.trim()) {
    return;
  }
  attaching.value = true;
  try {
    await staffOrdersStore.attachCustomer(props.orderId, {
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
    });
    emit("attached");
  } finally {
    attaching.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-bz-border bg-white p-4">
    <h2 class="text-sm font-semibold text-bz-ink-900">Attach a customer</h2>

    <template v-if="!showNewCustomerForm">
      <input
        v-model="query"
        type="text"
        placeholder="Search by name or phone"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        @input="onSearchInput"
      />
      <ul class="mt-2 space-y-1">
        <li v-for="customer in staffCustomersStore.results" :key="customer.id">
          <button
            type="button"
            class="w-full rounded-xl border border-bz-border px-3 py-2 text-left text-sm disabled:opacity-60"
            :disabled="attaching"
            @click="attachExisting(customer.id)"
          >
            {{ customer.name }} <span v-if="customer.phone" class="text-bz-ink-500">· {{ customer.phone }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="mt-2 text-sm text-bz-gold-700 underline underline-offset-2"
        @click="showNewCustomerForm = true"
      >
        + New customer
      </button>
    </template>

    <template v-else>
      <input
        v-model="newName"
        type="text"
        placeholder="Name"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <input
        v-model="newPhone"
        type="tel"
        placeholder="Phone (optional)"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-full border border-bz-border py-2 text-sm font-medium text-bz-ink-700"
          @click="showNewCustomerForm = false"
        >
          Back to search
        </button>
        <button
          type="button"
          class="flex-1 rounded-full bg-bz-gold-600 py-2 text-sm font-medium text-white disabled:opacity-60"
          :disabled="attaching || !newName.trim()"
          @click="attachNew"
        >
          Attach
        </button>
      </div>
    </template>
  </div>
</template>
