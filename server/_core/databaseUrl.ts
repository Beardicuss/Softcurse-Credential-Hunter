const SYSTEM_DATABASES = new Set([
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
]);

export function assertApplicationDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql://, received " + url.protocol);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim().toLowerCase();
  if (!database) {
    throw new Error("DATABASE_URL must include an application database name.");
  }
  if (SYSTEM_DATABASES.has(database)) {
    throw new Error('DATABASE_URL points to the reserved TiDB system database "' + database + '". Use the Hunter application database, normally "test".');
  }

  return connectionString;
}

export function ensureMysqlTls(connectionString: string): string {
  assertApplicationDatabaseUrl(connectionString);
  const url = new URL(connectionString);
  url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));

  return url.toString();
}
