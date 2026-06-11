import assert from "node:assert/strict";
import test from "node:test";

import { getSafeNextPath } from "../lib/utils.ts";

test("getSafeNextPath returns dashboard if no next path is provided", () => {
  assert.equal(getSafeNextPath(null), "/dashboard");
  assert.equal(getSafeNextPath(undefined), "/dashboard");
  assert.equal(getSafeNextPath(""), "/dashboard");
});

test("getSafeNextPath accepts safe internal paths", () => {
  assert.equal(getSafeNextPath("/copilot"), "/copilot");
  assert.equal(getSafeNextPath("/copilot?q=test"), "/copilot?q=test");
  assert.equal(getSafeNextPath("/dashboard"), "/dashboard");
});

test("getSafeNextPath accepts and decodes url-encoded paths", () => {
  assert.equal(getSafeNextPath("%2Fcopilot%3Fq%3Dtest"), "/copilot?q=test");
  assert.equal(getSafeNextPath("%2Fcopilot%3Fq%3D%E0%A6%AA%E0%A6%BE%E0%A6%B8%E0%A7%87"), "/copilot?q=পাসে");
});

test("getSafeNextPath rejects external redirects", () => {
  assert.equal(getSafeNextPath("https://evil.com"), "/dashboard");
  assert.equal(getSafeNextPath("http://evil.com/path"), "/dashboard");
  assert.equal(getSafeNextPath("//evil.com"), "/dashboard");
  assert.equal(getSafeNextPath("/\\evil.com"), "/dashboard");
  assert.equal(getSafeNextPath("%2F%2Fevil.com"), "/dashboard");
  assert.equal(getSafeNextPath("%2F%5Cevil.com"), "/dashboard");
});
