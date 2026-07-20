import { describe, expect, it } from "vitest";

import { ApiError } from "../src/api/http";
import { formatCurrency, formatDate, formatDateTime } from "../src/utils/currency";
import { toUserSafeErrorMessage } from "../src/utils/error-message";
import { generateIdempotencyKey } from "../src/utils/idempotency";
import { resolveMediaUrl } from "../src/utils/media-url";

describe("formatCurrency", () => {
  it("formats a decimal string with thousands separators", () => {
    expect(formatCurrency("1250.5")).toBe("Rs. 1,250.50");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("Rs. 0.00");
  });
  it("pins the digit-grouping behavior for large values (documents current en-PK ICU output for Admin/Staff totals)", () => {
    // This locks in the actual output observed from this environment's ICU data. If Node/ICU
    // versions change and this starts using South-Asian (lakh/crore) grouping instead of Western
    // grouping, this test will fail and flag the change for review before it reaches a real screen.
    expect(formatCurrency(250000)).toBe("Rs. 250,000.00");
  });
});

describe("formatDateTime / formatDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDateTime("2026-07-20T10:30:00.000Z")).toEqual(expect.any(String));
  });
  it("formats a date only", () => {
    expect(formatDate("2026-07-20T10:30:00.000Z")).toEqual(expect.any(String));
  });
});

describe("resolveMediaUrl", () => {
  it("returns null for empty input", () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl("")).toBeNull();
  });
  it("passes through an absolute URL unchanged", () => {
    expect(resolveMediaUrl("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
  });
  it("passes through a relative path unchanged", () => {
    expect(resolveMediaUrl("/uploads/media/products/x.png")).toBe("/uploads/media/products/x.png");
  });
});

describe("toUserSafeErrorMessage", () => {
  it("maps a 401 to a session-expired message", () => {
    expect(toUserSafeErrorMessage(new ApiError(401, "jwt malformed", { code: "UNAUTHORIZED" }))).toMatch(/session/i);
  });
  it("maps a 403 to a permission message", () => {
    expect(toUserSafeErrorMessage(new ApiError(403, "forbidden", { code: "FORBIDDEN" }))).toMatch(/permission/i);
  });
  it("passes through the backend message for a 409 conflict", () => {
    expect(
      toUserSafeErrorMessage(new ApiError(409, "Only a pending order can be accepted.", { code: "INVALID_ORDER_TRANSITION" })),
    ).toBe("Only a pending order can be accepted.");
  });
  it("maps a network failure to an offline message", () => {
    expect(toUserSafeErrorMessage(new TypeError("Failed to fetch"))).toMatch(/connection|offline/i);
  });
});

describe("generateIdempotencyKey", () => {
  it("returns a distinct string each call", () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey());
  });
});
