import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../../src/modules/auth/token.service.js";

type Agent = ReturnType<typeof request.agent>;

async function loginAdmin() {
  const response = await request(app).post("/api/v1/auth/login").send({
    email: "admin@bazm.local",
    password: "password",
    deviceName: "workflow-test",
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data.accessToken as string;
}

async function ensureProduct(adminToken: string) {
  const category = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `Workflow Cat ${Date.now()}`, isVisible: true });
  assert.equal(category.status, 201, JSON.stringify(category.body));

  const product = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Workflow Product ${Date.now()}`,
      categoryId: category.body.data.category.id,
      price: 100,
      preparationMinutes: 10,
      stockQuantity: 100,
      trackStock: true,
      isAvailable: true,
    });
  assert.equal(product.status, 201, JSON.stringify(product.body));
  return product.body.data.product.id as string;
}

async function createTable() {
  const uuid = randomUUID();
  const rawToken = generateOpaqueToken();
  const table = await prisma.restaurantTable.create({
    data: {
      uuid,
      tableNumber: `W-${Date.now().toString().slice(-6)}`,
      name: "Workflow Table",
      capacity: 4,
      qrTokenHash: hashOpaqueToken(rawToken),
      qrVersion: 1,
      qrImagePath: "/uploads/qr/test.png",
      qrGeneratedAt: new Date(),
    },
  });
  return { tableId: table.uuid, tableToken: rawToken, dbId: table.id };
}

async function advanceToServed(
  adminToken: string,
  orderId: string,
  options?: { attachCustomer?: boolean },
) {
  if (options?.attachCustomer !== false) {
    const customer = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Workflow Guest", phone: `0300${Date.now().toString().slice(-7)}` });
    assert.equal(customer.status, 201, JSON.stringify(customer.body));

    const attach = await request(app)
      .post(`/api/v1/orders/${orderId}/customer`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ customerId: customer.body.data.customer.id });
    assert.equal(attach.status, 200, JSON.stringify(attach.body));
  }

  for (const action of ["accept", "start-preparing", "mark-ready", "mark-served"]) {
    const response = await request(app)
      .post(`/api/v1/orders/${orderId}/${action}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(response.status, 200, `${action}: ${JSON.stringify(response.body)}`);
  }
}

describe("BAZM finalized workflows A–J", () => {
  let adminToken = "";
  let productId = "";

  before(async () => {
    await prisma.$connect();
    adminToken = await loginAdmin();
    productId = await ensureProduct(adminToken);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("Workflow A+E+F: multi-order dine-in, reclaim, and 409 occupied", async () => {
    const { tableToken, tableId } = await createTable();
    const guest: Agent = request.agent(app);

    const session = await guest.post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });
    assert.equal(session.status, 201, JSON.stringify(session.body));
    const sessionId = session.body.data.session.id as string;

    const order1 = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
    });
    assert.equal(order1.status, 201, JSON.stringify(order1.body));
    assert.equal(order1.body.data.order.orderStatus, "PENDING");
    assert.equal(order1.body.data.order.paymentStatus, "UNPAID");

    const order2 = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
    });
    assert.equal(order2.status, 201, JSON.stringify(order2.body));
    assert.notEqual(order1.body.data.order.id, order2.body.data.order.id);

    const list = await guest.get("/api/v1/guest/orders");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.orders.length >= 2);

    const table = await request(app)
      .get(`/api/v1/tables/${tableId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(table.status, 200);
    assert.equal(table.body.data.table.status, "OCCUPIED");

    // Same-device reclaim
    const reclaim = await guest.post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });
    assert.ok([200, 201].includes(reclaim.status), JSON.stringify(reclaim.body));
    assert.equal(reclaim.body.data.session.id, sessionId);

    // Different device → 409
    const other = await request(app).post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });
    assert.equal(other.status, 409);
    assert.equal(other.body.error?.code, "TABLE_SESSION_ALREADY_ACTIVE");
    assert.equal(other.body.success, false);
    assert.equal(other.body.data, undefined);
  });

  it("Workflow B+C+D: partial pay, multi-order settlement, receipt access", async () => {
    const { tableToken } = await createTable();
    const guest: Agent = request.agent(app);

    await guest.post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });

    const order1Res = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
    });
    const order2Res = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
    });
    const order1Id = order1Res.body.data.order.id as string;
    const order2Id = order2Res.body.data.order.id as string;
    const total1 = order1Res.body.data.order.totalAmount as string;

    await advanceToServed(adminToken, order1Id);
    await advanceToServed(adminToken, order2Id);

    const partialAmount = Number(total1) / 2;
    const partial = await request(app)
      .post(`/api/v1/orders/${order1Id}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: partialAmount,
        method: "CASH",
        idempotencyKey: `partial-${order1Id}`,
      });
    assert.equal(partial.status, 201, JSON.stringify(partial.body));
    assert.equal(partial.body.data.order.orderStatus, "SERVED");
    assert.equal(partial.body.data.order.paymentStatus, "PARTIALLY_PAID");

    const full1 = await request(app)
      .post(`/api/v1/orders/${order1Id}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: Number(partial.body.data.order.remainingAmount),
        method: "CASH",
        idempotencyKey: `full1-${order1Id}`,
      });
    assert.equal(full1.status, 201, JSON.stringify(full1.body));
    assert.equal(full1.body.data.order.orderStatus, "COMPLETED");
    assert.equal(full1.body.data.order.paymentStatus, "PAID");
    assert.equal(full1.body.data.sessionClosed, false);

    const current = await guest.get("/api/v1/guest/sessions/current");
    assert.equal(current.status, 200);
    assert.equal(current.body.data.session.isActive, true);

    const full2 = await request(app)
      .post(`/api/v1/orders/${order2Id}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: Number(order2Res.body.data.order.totalAmount),
        method: "CARD",
        idempotencyKey: `full2-${order2Id}`,
      });
    assert.equal(full2.status, 201, JSON.stringify(full2.body));
    assert.equal(full2.body.data.order.orderStatus, "COMPLETED");
    assert.equal(full2.body.data.sessionClosed, true);
    assert.ok(full2.body.data.receiptRawToken);

    // Guest session closed — receipt access still works
    const receiptAgent = request.agent(app);
    // Manually set receipt cookie via jar is hard; hit receipts with cookie header
    const receipt = await receiptAgent
      .get(`/api/v1/receipts/orders/${order1Id}/summary`)
      .set("Cookie", `bazm_receipt_access=${full2.body.data.receiptRawToken}`);
    assert.equal(receipt.status, 200, JSON.stringify(receipt.body));
    assert.equal(receipt.body.data.order.orderStatus, "COMPLETED");
    assert.equal(receipt.body.data.order.paymentStatus, "PAID");
  });

  it("Workflow G: recovery code generate + redeem + single-use", async () => {
    const { tableToken } = await createTable();
    const guest: Agent = request.agent(app);
    const created = await guest.post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });
    const sessionId = created.body.data.session.id as string;

    const codeRes = await request(app)
      .post(`/api/v1/guest-sessions/${sessionId}/recovery-codes`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(codeRes.status, 201, JSON.stringify(codeRes.body));
    const code = codeRes.body.data.recoveryCode as string;

    const other: Agent = request.agent(app);
    const redeem = await other.post("/api/v1/guest/sessions/recover").send({
      recoveryCode: code,
    });
    assert.equal(redeem.status, 200, JSON.stringify(redeem.body));
    assert.equal(redeem.body.data.session.id, sessionId);

    const reuse = await request(app).post("/api/v1/guest/sessions/recover").send({
      recoveryCode: code,
    });
    assert.equal(reuse.status, 401);
  });

  it("Workflow H: concurrent final payments do not overpay", async () => {
    const guest: Agent = request.agent(app);
    await guest.post("/api/v1/guest/sessions").send({ orderType: "TAKEAWAY" });
    const orderRes = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
      customerName: "Concurrency",
      customerPhone: "03001112233",
    });
    const orderId = orderRes.body.data.order.id as string;
    const total = Number(orderRes.body.data.order.totalAmount);
    await advanceToServed(adminToken, orderId, { attachCustomer: false });

    const results = await Promise.allSettled([
      request(app)
        .post(`/api/v1/orders/${orderId}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .timeout({ deadline: 10000 })
        .send({ amount: total, method: "CASH", idempotencyKey: `conc-a-${orderId}` }),
      request(app)
        .post(`/api/v1/orders/${orderId}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .timeout({ deadline: 10000 })
        .send({ amount: total, method: "CASH", idempotencyKey: `conc-b-${orderId}` }),
    ]);

    const responses = results
      .filter((r): r is PromiseFulfilledResult<request.Response> => r.status === "fulfilled")
      .map((r) => r.value);

    const summary = {
      settled: results.map((r) =>
        r.status === "fulfilled"
          ? { status: r.value.status, body: r.value.body }
          : { reason: String(r.reason) },
      ),
    };

    assert.ok(
      responses.some((r) => r.status === 201),
      `Expected one successful payment: ${JSON.stringify(summary)}`,
    );

    const payments = await request(app)
      .get(`/api/v1/orders/${orderId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`);
    const completed = payments.body.data.payments.filter(
      (p: { status: string; voidedAt: string | null }) =>
        p.status === "COMPLETED" && p.voidedAt === null,
    );
    const paid = completed.reduce(
      (sum: number, p: { amount: string }) => sum + Number(p.amount),
      0,
    );
    assert.equal(
      completed.length,
      1,
      `Overpay detected: ${JSON.stringify(payments.body)}`,
    );
    assert.ok(Math.abs(paid - total) < 0.001);
  });

  it("Workflow I: payment reversal returns COMPLETED → SERVED", async () => {
    const guest: Agent = request.agent(app);
    await guest.post("/api/v1/guest/sessions").send({ orderType: "TAKEAWAY" });
    const orderRes = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
      customerName: "Reverse",
      customerPhone: "03004445566",
    });
    const orderId = orderRes.body.data.order.id as string;
    const total = Number(orderRes.body.data.order.totalAmount);
    await advanceToServed(adminToken, orderId, { attachCustomer: false });

    const pay = await request(app)
      .post(`/api/v1/orders/${orderId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: total,
        method: "CASH",
        idempotencyKey: `rev-pay-${orderId}`,
      });
    assert.equal(pay.body.data.order.orderStatus, "COMPLETED");
    assert.equal(pay.body.data.order.paymentStatus, "PAID");
    const paymentId = pay.body.data.payment.id as string;

    const reverse = await request(app)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Wrong amount entered" });
    assert.equal(reverse.status, 200, JSON.stringify(reverse.body));
    assert.equal(reverse.body.data.order.orderStatus, "SERVED");
    assert.equal(reverse.body.data.order.paymentStatus, "UNPAID");
    assert.ok(reverse.body.data.payment.voidedAt);
  });

  it("Workflow J: release blocked while unpaid; force-release works", async () => {
    const { tableToken, tableId } = await createTable();
    const guest: Agent = request.agent(app);
    await guest.post("/api/v1/guest/sessions").send({
      orderType: "DINE_IN",
      tableToken,
    });
    const orderRes = await guest.post("/api/v1/guest/orders").send({
      items: [{ productId, quantity: 1 }],
    });
    const orderId = orderRes.body.data.order.id as string;
    await advanceToServed(adminToken, orderId);

    const blocked = await request(app)
      .post(`/api/v1/tables/${tableId}/release`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(blocked.status, 409);

    const forced = await request(app)
      .post(`/api/v1/tables/${tableId}/force-release`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Customer left without paying — follow up later" });
    assert.equal(forced.status, 200, JSON.stringify(forced.body));

    const table = await request(app)
      .get(`/api/v1/tables/${tableId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(table.body.data.table.status, "AVAILABLE");

    const order = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(order.body.data.order.orderStatus, "SERVED");
    assert.equal(order.body.data.order.paymentStatus, "UNPAID");
  });
});
