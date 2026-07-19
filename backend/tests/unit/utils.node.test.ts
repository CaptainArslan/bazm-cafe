import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { money, percentOf, sumMoney, toMoneyString } from "../../src/utils/money.js";
import { slugify } from "../../src/utils/slug.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../../src/modules/auth/token.service.js";

describe("slugify", () => {
  it("normalizes names into slugs", () => {
    assert.equal(slugify("  Aloo Samosa!! "), "aloo-samosa");
  });
});

describe("money helpers", () => {
  it("formats and sums decimal-safe money", () => {
    assert.equal(toMoneyString(money("10.5")), "10.50");
    assert.equal(toMoneyString(sumMoney(["10.10", "20.20"])), "30.30");
  });

  it("applies percent rates with half-up rounding", () => {
    assert.equal(toMoneyString(percentOf("100", 5)), "5.00");
    assert.equal(toMoneyString(percentOf("10.00", 10)), "1.00");
    assert.equal(toMoneyString(percentOf("33.33", 5)), "1.67");
  });
});

describe("opaque tokens", () => {
  it("hashes tokens deterministically", () => {
    const token = generateOpaqueToken();
    assert.equal(token.length, 64);
    assert.equal(hashOpaqueToken(token), hashOpaqueToken(token));
    assert.notEqual(hashOpaqueToken(token), token);
  });
});
