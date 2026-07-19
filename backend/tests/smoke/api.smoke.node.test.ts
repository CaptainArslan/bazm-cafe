import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

describe("BAZM API smoke", () => {
  before(async () => {
    await prisma.$connect();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("GET /api/v1/health returns success", async () => {
    const response = await request(app).get("/api/v1/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });

  it("POST /api/v1/auth/login accepts seeded admin", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "admin@bazm.local",
      password: "password",
      deviceName: "node-test",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(typeof response.body.data.accessToken, "string");
    assert.equal(response.body.data.user.role, "ADMIN");
  });

  it("rejects unauthorized staff list", async () => {
    const response = await request(app).get("/api/v1/staff");
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });
});
