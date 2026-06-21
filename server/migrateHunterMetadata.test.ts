import { describe, expect, it } from "vitest";
import { HUNTER_METADATA_COLUMNS } from "./migrateHunterMetadata";

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
});
