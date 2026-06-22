import { describe, expect, it, vi } from "vitest";
import { buildAddIndexSql, HUNTER_METADATA_COLUMNS, HUNTER_QUERY_INDEXES, migrateHunterMetadata } from "./migrateHunterMetadata";

describe("Hunter metadata migration plan", () => {
  it("contains unique, static column names", () => {
    const names = HUNTER_METADATA_COLUMNS.map(column => column.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "confidence",
      "match_strength",
      "validation_tier",
      "validation_status",
      "validation_reason",
      "source",
      "evidence_url",
      "discovered_at",
      "last_validated_at",
      "freshness",
      "revalidation_suggested",
    ]);
  });

  it("does not contain destructive SQL in column definitions", () => {
    for (const column of HUNTER_METADATA_COLUMNS) {
      expect(column.name).toMatch(/^[a-z_]+$/);
      expect(column.definition).not.toMatch(
        /\b(drop|delete|truncate|rename)\b/i
      );
    }
  });
  it("defines unique static query indexes for rate limits and lifecycle scans", () => {
    const names = HUNTER_QUERY_INDEXES.map(index => index.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "idx_audit_event_created",
      "idx_audit_created",
      "idx_api_validity_checked",
      "idx_api_revalidate_checked",
    ]);
    for (const index of HUNTER_QUERY_INDEXES) {
      expect(index.table).toMatch(/^[a-z_]+$/);
      expect(index.name).toMatch(/^[a-z_]+$/);
      expect(index.columns.length).toBeGreaterThan(0);
      expect(index.columns.every(column => /^[a-z_]+$/.test(column))).toBe(true);
    }
  });

  it("generates additive non-destructive index SQL only", () => {
    for (const index of HUNTER_QUERY_INDEXES) {
      const statement = buildAddIndexSql(index);
      expect(statement).toMatch(/^ALTER TABLE `[a-z_]+` ADD INDEX `[a-z_]+`/);
      expect(statement).not.toMatch(/\b(drop|delete|truncate|rename|modify)\b/i);
    }
  });
  it("is idempotent when columns and indexes already exist", async () => {
    const query = vi.fn(async (statement: string) => {
      if (/information_schema\.(TABLES|COLUMNS|STATISTICS)/.test(statement)) {
        return [[{ count: 1 }]];
      }
      throw new Error(`Unexpected mutation SQL: ${statement}`);
    });
    const end = vi.fn(async () => undefined);
    const connectionFactory = vi.fn(async () => ({ query, end })) as any;

    const result = await migrateHunterMetadata(
      "mysql://user:pass@example.test:4000/db",
      connectionFactory
    );

    expect(result.added).toEqual([]);
    expect(result.indexesAdded).toEqual([]);
    expect(result.existing).toHaveLength(HUNTER_METADATA_COLUMNS.length);
    expect(result.indexesExisting).toHaveLength(HUNTER_QUERY_INDEXES.length);
    expect(query.mock.calls.some(([statement]) => /^ALTER TABLE/i.test(statement))).toBe(false);
    expect(end).toHaveBeenCalledOnce();
  });
});