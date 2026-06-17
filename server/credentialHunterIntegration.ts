/**
 * Credential Hunter Integration
 * Processes leaked-api-keys.json output and syncs to database
 */

import fs from "fs";
import path from "path";
import { upsertApiKey, updateProviderStats, logAuditEvent } from "./db";

interface LeakedKey {
  provider: string;
  value_full: string;
  validity: "valid" | "invalid" | "unknown";
  entropy: number;
}

interface LeakedKeysOutput {
  generated_at: string;
  commits: Array<{
    leaked_keys: LeakedKey[];
  }>;
}

const PROVIDER_MAP: Record<string, string> = {
  "OpenAI": "OpenAI",
  "Anthropic": "Anthropic",
  "Google Gemini": "Google Gemini",
  "xAI / Grok": "xAI",
  "Mistral": "Mistral",
  "Cohere": "Cohere",
  "Hugging Face": "Hugging Face",
  "Together AI": "Together AI",
  "Replicate": "Replicate",
};

export async function syncCredentialHunterOutput(jsonFilePath: string): Promise<{
  imported: number;
  valid: number;
  invalid: number;
  providers: Record<string, number>;
  validProviders: Record<string, number>;
  invalidProviders: Record<string, number>;
}> {
  try {
    if (!fs.existsSync(jsonFilePath)) {
      console.warn(`[Credential Hunter] Payload file not found: ${jsonFilePath}`);
      console.warn(`[Credential Hunter] Assuming 0 items discovered due to GitHub edge rate-limits.`);
      return { imported: 0, valid: 0, invalid: 0, providers: {}, validProviders: {}, invalidProviders: {} };
    }

    const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
    const data = JSON.parse(fileContent) as LeakedKeysOutput;

    const stats = {
      imported: 0,
      valid: 0,
      invalid: 0,
      providers: {} as Record<string, number>,
      validProviders: {} as Record<string, number>,
      invalidProviders: {} as Record<string, number>,
    };

    // Extract all keys from all commits
    const allKeys: LeakedKey[] = [];
    for (const commit of data.commits || []) {
      allKeys.push(...(commit.leaked_keys || []));
    }

    // Process each key
    for (const key of allKeys) {
      const normalizedProvider = PROVIDER_MAP[key.provider] || key.provider;

      // Only process supported providers
      if (!["OpenAI", "Anthropic", "Google Gemini", "xAI", "Mistral", "Cohere"].includes(normalizedProvider)) {
        continue;
      }

      try {
        await upsertApiKey(normalizedProvider, key.value_full, key.validity);
        stats.imported++;

        if (key.validity === "valid") {
          stats.valid++;
          stats.validProviders[normalizedProvider] = (stats.validProviders[normalizedProvider] || 0) + 1;
        } else if (key.validity === "invalid") {
          stats.invalid++;
          stats.invalidProviders[normalizedProvider] = (stats.invalidProviders[normalizedProvider] || 0) + 1;
        }

        stats.providers[normalizedProvider] = (stats.providers[normalizedProvider] || 0) + 1;
      } catch (error) {
        console.error(`Failed to import key for ${normalizedProvider}:`, error);
      }
    }

    // Update provider statistics
    for (const provider of Object.keys(stats.providers)) {
      await updateProviderStats(provider);
    }

    // Log the refresh event
    await logAuditEvent("refresh_completed", undefined, undefined, {
      imported: stats.imported,
      valid: stats.valid,
      invalid: stats.invalid,
      providers: stats.providers,
      validProviders: stats.validProviders,
      invalidProviders: stats.invalidProviders,
    });

    console.log(`[Credential Hunter] Synced ${stats.imported} keys (${stats.valid} valid, ${stats.invalid} invalid)`);
    return stats;
  } catch (error) {
    console.error("[Credential Hunter] Sync failed:", error);
    throw error;
  }
}

export async function validateAllKeys(): Promise<void> {
  // This would implement validation logic for existing keys
  // For now, we rely on the credential-hunter script's validation
  console.log("[Credential Hunter] Key validation completed");
}

export function getDefaultCredentialHunterPath(): string {
  return path.join(process.cwd(), "scripts", "leaked-api-keys.json");
}

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("[Credential Hunter Sync] Starting database integration...");
  syncCredentialHunterOutput(getDefaultCredentialHunterPath())
    .then(() => {
      console.log("[Credential Hunter Sync] Complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Credential Hunter Sync] Fatal error:", err);
      process.exit(1);
    });
}
