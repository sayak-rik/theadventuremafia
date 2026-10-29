import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, otpMatches } from "@/lib/otp";

describe("otp", () => {
  it("generates 6 numeric digits", () => {
    for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("stores only a keyed hash that is bound to scope and email", () => {
    const h = hashOtp("customer", "A@x.com", "123456");
    expect(h).not.toContain("123456");
    expect(otpMatches(h, "customer", "a@x.com", "123456")).toBe(true); // email is case-insensitive
    expect(otpMatches(h, "customer", "a@x.com", "123457")).toBe(false);
    expect(otpMatches(h, "operator", "a@x.com", "123456")).toBe(false); // different scope
    expect(otpMatches(h, "customer", "b@x.com", "123456")).toBe(false); // different email
    expect(otpMatches(null, "customer", "a@x.com", "123456")).toBe(false);
  });
});
