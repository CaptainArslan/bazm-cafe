import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getGuestSessionCookieOptions,
  getReceiptAccessCookieOptions,
} from "../../src/modules/guest-sessions/guest-session.constants.js";

describe("guest session cookie scope", () => {
  it("scopes the guest session cookie to the whole app, not just /api/v1", () => {
    // Socket.IO's handshake lives at "/socket.io", outside "/api/v1" — a cookie scoped
    // to "/api/v1" is never sent there, so a guest's socket can never join its session
    // room and never receives real-time order updates. See guest-session.constants.ts.
    assert.equal(getGuestSessionCookieOptions().path, "/");
  });

  it("scopes the receipt access cookie the same way", () => {
    assert.equal(getReceiptAccessCookieOptions().path, "/");
  });
});
