import { describe, expect, it } from "vitest";
import { planAuditRetention } from "./auditRetention";

describe("Hunter audit retention", () => {
  const now = new Date("2026-06-22T00:00:00.000Z");

  it("expires rate-limit telemetry earlier than security audits", () => {
    const plan = planAuditRetention([
      { id: 1, eventType: "rate_limit:reveal:actor", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: 2, eventType: "key_revealed", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: 3, eventType: "key_copied", createdAt: "2025-01-01T00:00:00.000Z" },
    ], now);
    expect(plan.expiredIds).toEqual([1, 3]);
    expect(plan.totals).toMatchObject({ expired: 2, rateLimit: 1, security: 1 });
  });

  it("honors batch bounds and ignores malformed timestamps", () => {
    const plan = planAuditRetention([
      { id: 1, eventType: "rate_limit:a", createdAt: "2020-01-01T00:00:00.000Z" },
      { id: 2, eventType: "rate_limit:b", createdAt: "2020-01-01T00:00:00.000Z" },
      { id: 3, eventType: "rate_limit:c", createdAt: "invalid" },
    ], now, { rateLimitDays: 1, securityAuditDays: 1, batchSize: 1 });
    expect(plan.expiredIds).toEqual([1]);
  });
});
