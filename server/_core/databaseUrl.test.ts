import { describe, expect, it } from "vitest";
import { ensureMysqlTls } from "./databaseUrl";

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
});
