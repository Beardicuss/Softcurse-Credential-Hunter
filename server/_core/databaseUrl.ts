export function ensureMysqlTls(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") {
    throw new Error(`DATABASE_URL must use mysql://, received ${url.protocol}`);
  }

  url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));

  return url.toString();
}
