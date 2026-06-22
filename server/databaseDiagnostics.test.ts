import { describe, expect, it } from "vitest";
import { classifyDatabaseDiagnosticError } from "./db";

describe("database diagnostics", () => {
  it("classifies common connection failures without exposing details", () => {
    expect(classifyDatabaseDiagnosticError(new Error("Access denied for user secret-user"))).toBe("access_denied");
    expect(classifyDatabaseDiagnosticError(new Error("Table test.api_keys doesn't exist"))).toBe("schema_missing");
    expect(classifyDatabaseDiagnosticError(new Error("DATABASE_URL points to the reserved TiDB system database sys"))).toBe("system_database");
    expect(classifyDatabaseDiagnosticError(new Error("socket timeout"))).toBe("timeout");
    expect(classifyDatabaseDiagnosticError(new Error("host-sensitive unexpected failure"))).toBe("query_failed");
  });
});
