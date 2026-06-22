import { describe, expect, it } from "vitest";
import { assertApplicationDatabaseUrl, ensureMysqlTls } from "./databaseUrl";

describe("ensureMysqlTls", () => {
  it("adds verified TLS configuration for mysql2 URLs", () => {
    const secured = new URL(
      ensureMysqlTls("mysql://user:pass@example.com:4000/app")
    );
    expect(JSON.parse(secured.searchParams.get("ssl") || "null")).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("overrides insecure SSL parameters and remains idempotent", () => {
    const input =
      "mysql://user:pass@example.com:4000/app?ssl=%7B%22rejectUnauthorized%22%3Afalse%7D";
    const secured = ensureMysqlTls(input);
    expect(
      JSON.parse(new URL(secured).searchParams.get("ssl") || "null")
    ).toEqual({ rejectUnauthorized: true });
    expect(ensureMysqlTls(secured)).toBe(secured);
  });

  it("rejects non-MySQL database URLs", () => {
    expect(() =>
      ensureMysqlTls("postgres://user:pass@example.com/app")
    ).toThrow("must use mysql://");
  });
  it("rejects TiDB system databases", () => {
    for (const database of ["sys", "mysql", "information_schema", "performance_schema"]) {
      expect(() =>
        assertApplicationDatabaseUrl("mysql://user:pass@example.com:4000/" + database)
      ).toThrow("reserved TiDB system database");
    }
  });

  it("accepts an application database", () => {
    expect(
      assertApplicationDatabaseUrl("mysql://user:pass@example.com:4000/test")
    ).toContain("/test");
  });
});
