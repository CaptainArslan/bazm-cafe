import fs from "node:fs";

function req(name, method, path, opts = {}) {
  const pathParts = path.replace(/^\//, "").split("/").filter(Boolean);
  const item = {
    name,
    request: {
      method,
      header: opts.body
        ? [{ key: "Content-Type", value: "application/json" }]
        : [],
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ["{{baseUrl}}"],
        path: pathParts,
      },
      auth: { type: "noauth" },
    },
  };

  if (opts.query) {
    item.request.url.query = opts.query;
    item.request.url.raw =
      `{{baseUrl}}${path}?` +
      opts.query
        .filter((q) => !q.disabled)
        .map((q) => `${q.key}=${q.value}`)
        .join("&");
  }

  if (opts.body) {
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(opts.body, null, 2),
    };
  }

  if (opts.auth === "admin" || opts.auth === "staff") {
    item.request.auth = {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: opts.auth === "admin" ? "{{accessToken}}" : "{{staffAccessToken}}",
          type: "string",
        },
      ],
    };
  }

  if (opts.save) {
    item.event = [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: opts.save,
        },
      },
    ];
  }

  return item;
}

const saveAccess = [
  "if (pm.response.code === 200) {",
  "  const json = pm.response.json();",
  "  if (json.data && json.data.accessToken) {",
  "    pm.environment.set('accessToken', json.data.accessToken);",
  "  }",
  "}",
];

const saveStaffAccess = [
  "if (pm.response.code === 200) {",
  "  const json = pm.response.json();",
  "  if (json.data && json.data.accessToken) {",
  "    pm.environment.set('staffAccessToken', json.data.accessToken);",
  "  }",
  "}",
];

const collection = {
  info: {
    name: "BAZM Cafe Backend API",
    description:
      "Import this collection AND BAZM_Cafe_Backend.local.postman_environment.json.\\n\\nSuggested order: Health → Auth login → Staff → Settings → Customers → Tables → Categories → Products → Guest TAKEAWAY → Orders ops → Payments.\\n\\nFor dine-in tableToken run: npx tsx scripts/create-postman-table.ts and paste values into the environment.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [{ key: "baseUrl", value: "http://localhost:3000" }],
  item: [
    {
      name: "00 Health",
      item: [
        req("API root", "GET", "/api/v1/", { auth: "none" }),
        req("Health", "GET", "/api/v1/health", { auth: "none" }),
      ],
    },
    {
      name: "01 Auth",
      item: [
        req("Login admin", "POST", "/api/v1/auth/login", {
          auth: "none",
          body: {
            email: "{{adminEmail}}",
            password: "{{adminPassword}}",
            deviceName: "Postman",
          },
          save: saveAccess,
        }),
        req("Me", "GET", "/api/v1/auth/me", { auth: "admin" }),
        req("Refresh", "POST", "/api/v1/auth/refresh", {
          auth: "none",
          save: saveAccess,
        }),
        req("Login staff", "POST", "/api/v1/auth/login", {
          auth: "none",
          body: {
            email: "{{staffEmail}}",
            password: "{{staffPassword}}",
            deviceName: "Postman Staff",
          },
          save: saveStaffAccess,
        }),
        req("Logout", "POST", "/api/v1/auth/logout", { auth: "admin" }),
        req("Logout all", "POST", "/api/v1/auth/logout-all", { auth: "admin" }),
      ],
    },
    {
      name: "01b Settings (ADMIN)",
      item: [
        req("Get cafe settings", "GET", "/api/v1/settings", { auth: "admin" }),
        req("Update cafe settings (keep 0)", "PATCH", "/api/v1/settings", {
          auth: "admin",
          body: {
            taxRatePercent: 0,
            serviceChargePercent: 0,
          },
        }),
        req("Set tax and service charge", "PATCH", "/api/v1/settings", {
          auth: "admin",
          body: {
            taxRatePercent: 5,
            serviceChargePercent: 10,
          },
        }),
        req("Reset tax and service charge to 0", "PATCH", "/api/v1/settings", {
          auth: "admin",
          body: {
            taxRatePercent: 0,
            serviceChargePercent: 0,
          },
        }),
      ],
    },
    {
      name: "02 Staff (ADMIN)",
      item: [
        req("Create staff", "POST", "/api/v1/staff", {
          auth: "admin",
          body: {
            name: "Kitchen Staff",
            email: "{{staffEmail}}",
            phone: "03001234567",
            password: "{{staffPassword}}",
          },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('staffId', json.data.staff.id);",
            "}",
          ],
        }),
        req("List staff", "GET", "/api/v1/staff", {
          auth: "admin",
          query: [
            { key: "search", value: "staff", disabled: true },
            { key: "isActive", value: "true", disabled: true },
          ],
        }),
        req("Get staff", "GET", "/api/v1/staff/{{staffId}}", { auth: "admin" }),
        req("Update staff", "PATCH", "/api/v1/staff/{{staffId}}", {
          auth: "admin",
          body: { name: "Kitchen Staff Updated", phone: "03007654321" },
        }),
        req("Deactivate staff", "PATCH", "/api/v1/staff/{{staffId}}/status", {
          auth: "admin",
          body: { isActive: false },
        }),
        req("Activate staff", "PATCH", "/api/v1/staff/{{staffId}}/status", {
          auth: "admin",
          body: { isActive: true },
        }),
      ],
    },
    {
      name: "03 Customers (ADMIN/STAFF)",
      item: [
        req("Create customer", "POST", "/api/v1/customers", {
          auth: "admin",
          body: { name: "Ali Khan", phone: "03001112233" },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('customerId', json.data.customer.id);",
            "}",
          ],
        }),
        req("List customers", "GET", "/api/v1/customers", {
          auth: "admin",
          query: [{ key: "search", value: "Ali", disabled: true }],
        }),
        req("Get customer", "GET", "/api/v1/customers/{{customerId}}", {
          auth: "admin",
        }),
        req("Update customer", "PATCH", "/api/v1/customers/{{customerId}}", {
          auth: "admin",
          body: { name: "Ali Khan Updated" },
        }),
      ],
    },
    {
      name: "04 Tables (ADMIN)",
      item: [
        req("Create table", "POST", "/api/v1/tables", {
          auth: "admin",
          body: { tableNumber: "A1", name: "Window Table", capacity: 4 },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('tableId', json.data.table.id);",
            "  pm.environment.set('tableNumber', json.data.table.tableNumber);",
            "}",
          ],
        }),
        req("List tables", "GET", "/api/v1/tables", { auth: "admin" }),
        req("Get table", "GET", "/api/v1/tables/{{tableId}}", { auth: "admin" }),
        req("Update table", "PATCH", "/api/v1/tables/{{tableId}}", {
          auth: "admin",
          body: { name: "Window Table Updated", capacity: 6 },
        }),
        req("Update table status", "PATCH", "/api/v1/tables/{{tableId}}/status", {
          auth: "admin",
          body: { operationalStatus: "AVAILABLE", isActive: true },
        }),
        req("Get QR code", "GET", "/api/v1/tables/{{tableId}}/qr-code", {
          auth: "admin",
        }),
        req("Regenerate QR code", "POST", "/api/v1/tables/{{tableId}}/qr-code/regenerate", {
          auth: "admin",
        }),
      ],
    },
    {
      name: "05 Categories (ADMIN)",
      item: [
        req("Create category", "POST", "/api/v1/categories", {
          auth: "admin",
          body: {
            name: "Snacks",
            description: "Tea-time snacks",
            displayOrder: 1,
            isVisible: true,
          },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('categoryId', json.data.category.id);",
            "}",
          ],
        }),
        req("List categories", "GET", "/api/v1/categories", { auth: "admin" }),
        req("Get category", "GET", "/api/v1/categories/{{categoryId}}", {
          auth: "admin",
        }),
        req("Update category", "PATCH", "/api/v1/categories/{{categoryId}}", {
          auth: "admin",
          body: { description: "Updated snacks" },
        }),
        req("Update category status", "PATCH", "/api/v1/categories/{{categoryId}}/status", {
          auth: "admin",
          body: { isVisible: true },
        }),
      ],
    },
    {
      name: "06 Products (ADMIN)",
      item: [
        req("Create product", "POST", "/api/v1/products", {
          auth: "admin",
          body: {
            categoryId: "{{categoryId}}",
            name: "Aloo Samosa",
            description: "Crispy potato samosa",
            price: 80,
            stockQuantity: 40,
            trackStock: true,
            isAvailable: true,
            displayOrder: 1,
          },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('productId', json.data.product.id);",
            "}",
          ],
        }),
        req("List products", "GET", "/api/v1/products", { auth: "admin" }),
        req("Get product", "GET", "/api/v1/products/{{productId}}", {
          auth: "admin",
        }),
        req("Update product", "PATCH", "/api/v1/products/{{productId}}", {
          auth: "admin",
          body: { price: 90 },
        }),
        req("Update product status", "PATCH", "/api/v1/products/{{productId}}/status", {
          auth: "admin",
          body: { isAvailable: true },
        }),
        req("Adjust stock", "PATCH", "/api/v1/products/{{productId}}/stock", {
          auth: "admin",
          body: { quantityDelta: 10, reason: "Restocked from kitchen" },
        }),
      ],
    },
    {
      name: "07 Guest TAKEAWAY flow",
      item: [
        req("Create takeaway session", "POST", "/api/v1/guest/sessions", {
          auth: "none",
          body: { orderType: "TAKEAWAY" },
        }),
        req("Current session", "GET", "/api/v1/guest/sessions/current", {
          auth: "none",
        }),
        req("Guest menu", "GET", "/api/v1/guest/menu", { auth: "none" }),
        req("Create guest order", "POST", "/api/v1/guest/orders", {
          auth: "none",
          body: {
            customerName: "Sara Ahmed",
            customerPhone: "03009998877",
            customerNotes: "Extra spicy",
            items: [
              {
                productId: "{{productId}}",
                quantity: 2,
                notes: "No onion",
              },
            ],
          },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('guestOrderId', json.data.order.id);",
            "  pm.environment.set('orderId', json.data.order.id);",
            "}",
          ],
        }),
        req("List guest orders", "GET", "/api/v1/guest/orders", {
          auth: "none",
        }),
        req("Get guest order", "GET", "/api/v1/guest/orders/{{guestOrderId}}", {
          auth: "none",
        }),
        req("Guest receipt HTML", "GET", "/api/v1/guest/orders/{{guestOrderId}}/receipt", {
          auth: "none",
        }),
        req("Guest receipt image", "GET", "/api/v1/guest/orders/{{guestOrderId}}/receipt-image", {
          auth: "none",
        }),
      ],
    },
    {
      name: "08 Guest DINE_IN flow",
      item: [
        req("Resolve table QR", "POST", "/api/v1/guest/tables/resolve", {
          auth: "none",
          body: { tableToken: "{{tableToken}}" },
        }),
        req("Create dine-in session", "POST", "/api/v1/guest/sessions", {
          auth: "none",
          body: { orderType: "DINE_IN", tableToken: "{{tableToken}}" },
        }),
        req("Create dine-in order", "POST", "/api/v1/guest/orders", {
          auth: "none",
          body: {
            items: [{ productId: "{{productId}}", quantity: 1 }],
          },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('guestOrderId', json.data.order.id);",
            "  pm.environment.set('orderId', json.data.order.id);",
            "}",
          ],
        }),
        req("Close guest session", "POST", "/api/v1/guest/sessions/close", {
          auth: "none",
        }),
      ],
    },
    {
      name: "09 Orders ops (ADMIN/STAFF)",
      item: [
        req("List orders", "GET", "/api/v1/orders", { auth: "admin" }),
        req("List unpaid orders", "GET", "/api/v1/orders", {
          auth: "admin",
          query: [{ key: "paymentStatus", value: "UNPAID" }],
        }),
        req("List partially paid", "GET", "/api/v1/orders", {
          auth: "admin",
          query: [{ key: "paymentStatus", value: "PARTIALLY_PAID" }],
        }),
        req("Get order", "GET", "/api/v1/orders/{{orderId}}", { auth: "admin" }),
        req("Accept order", "POST", "/api/v1/orders/{{orderId}}/accept", {
          auth: "admin",
        }),
        req("Start preparing", "POST", "/api/v1/orders/{{orderId}}/start-preparing", {
          auth: "admin",
        }),
        req("Mark ready", "POST", "/api/v1/orders/{{orderId}}/mark-ready", {
          auth: "admin",
        }),
        req("Attach customer", "POST", "/api/v1/orders/{{orderId}}/customer", {
          auth: "admin",
          body: { customerId: "{{customerId}}" },
        }),
        req("Mark served", "POST", "/api/v1/orders/{{orderId}}/mark-served", {
          auth: "admin",
        }),
        req("Reject order (PENDING only)", "POST", "/api/v1/orders/{{orderId}}/reject", {
          auth: "admin",
          body: { reason: "Item unavailable" },
        }),
        req("Cancel order (ADMIN)", "POST", "/api/v1/orders/{{orderId}}/cancel", {
          auth: "admin",
          body: { reason: "Customer left" },
        }),
        req("Order receipt HTML", "GET", "/api/v1/orders/{{orderId}}/receipt", {
          auth: "admin",
        }),
        req("Order receipt image", "GET", "/api/v1/orders/{{orderId}}/receipt-image", {
          auth: "admin",
        }),
      ],
    },
    {
      name: "10 Payments (ADMIN)",
      item: [
        req("Record partial payment", "POST", "/api/v1/orders/{{orderId}}/payments", {
          auth: "admin",
          body: { amount: 50, method: "CASH", notes: "Partial cash" },
          save: [
            "if (pm.response.code === 201) {",
            "  const json = pm.response.json();",
            "  pm.environment.set('paymentId', json.data.payment.id);",
            "}",
          ],
        }),
        req("List order payments", "GET", "/api/v1/orders/{{orderId}}/payments", {
          auth: "admin",
        }),
        req("Record remaining payment", "POST", "/api/v1/orders/{{orderId}}/payments", {
          auth: "admin",
          body: {
            amount: 130,
            method: "EASYPAISA",
            reference: "EP-12345",
          },
        }),
        req("List all payments", "GET", "/api/v1/payments", { auth: "admin" }),
        req("Get payment", "GET", "/api/v1/payments/{{paymentId}}", {
          auth: "admin",
        }),
      ],
    },
  ],
};

fs.mkdirSync("docs/postman", { recursive: true });
fs.writeFileSync(
  "docs/postman/BAZM_Cafe_Backend.postman_collection.json",
  JSON.stringify(collection, null, 2),
);
console.log("Wrote docs/postman/BAZM_Cafe_Backend.postman_collection.json");
