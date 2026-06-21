import { createConnection, type RowDataPacket } from "mysql2/promise";
import { fileURLToPath } from "node:url";
import { ensureMysqlTls } from "./_core/databaseUrl";

export const HUNTER_METADATA_COLUMNS = [
  { name: "confidence", definition: "double" },
  { name: "match_strength", definition: "varchar(32)" },
  { name: "validation_tier", definition: "varchar(16)" },
  { name: "validation_status", definition: "varchar(64)" },
  { name: "validation_reason", definition: "text" },
  { name: "source", definition: "varchar(64)" },
  { name: "evidence_url", definition: "text" },
  { name: "discovered_at", definition: "timestamp NULL" },
  { name: "last_validated_at", definition: "timestamp NULL" },
  { name: "freshness", definition: "varchar(16)" },
  {
    name: "revalidation_suggested",
    definition: "boolean NOT NULL DEFAULT false",
  },
] as const;

export async function migrateHunterMetadata(
  connectionString: string
): Promise<{ added: string[]; existing: string[] }> {
  const connection = await createConnection(ensureMysqlTls(connectionString));
  const added: string[] = [];
  const existing: string[] = [];

  try {
    const [tables] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      ["api_keys"]
    );
    if (Number(tables[0]?.count || 0) === 0) {
      throw new Error(
        "Required table api_keys does not exist; initialize the base schema before metadata migration"
      );
    }

    for (const column of HUNTER_METADATA_COLUMNS) {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        ["api_keys", column.name]
      );

      if (Number(rows[0]?.count || 0) > 0) {
        existing.push(column.name);
        continue;
      }

      await connection.query(
        `ALTER TABLE \`api_keys\` ADD COLUMN \`${column.name}\` ${column.definition}`
      );
      added.push(column.name);
    }

    return { added, existing };
  } finally {
    await connection.end();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required for Hunter metadata migration");

  const result = await migrateHunterMetadata(connectionString);
  console.log(
    `[Hunter Migration] Added ${result.added.length} column(s); ${result.existing.length} already present.`
  );
  if (result.added.length)
    console.log(`[Hunter Migration] Added: ${result.added.join(", ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(
      `[Hunter Migration] Failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
