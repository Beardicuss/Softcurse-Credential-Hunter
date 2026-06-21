import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the auth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * API Keys table for storing harvested and validated AI provider keys
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(), // OpenAI, Anthropic, Google Gemini, xAI, Mistral, Cohere
  keyValue: text("key_value").notNull(), // Full API key (encrypted in production)
  keyMasked: varchar("key_masked", { length: 64 }).notNull(), // Masked version for display (e.g., "sk-...abc123")
  validity: mysqlEnum("validity", ["valid", "invalid", "unknown", "rate_limited"]).default("unknown").notNull(),
  confidence: double("confidence"),
  matchStrength: varchar("match_strength", { length: 32 }),
  validationTier: varchar("validation_tier", { length: 16 }),
  validationStatus: varchar("validation_status", { length: 64 }),
  validationReason: text("validation_reason"),
  source: varchar("source", { length: 64 }),
  evidenceUrl: text("evidence_url"),
  discoveredAt: timestamp("discovered_at"),
  lastValidatedAt: timestamp("last_validated_at"),
  freshness: varchar("freshness", { length: 16 }),
  revalidationSuggested: boolean("revalidation_suggested").default(false).notNull(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: int("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Audit logs for tracking key usage, fallback events, and provider switches
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(), // "key_validated", "key_used", "fallback_triggered", "provider_switched", "refresh_completed"
  provider: varchar("provider", { length: 64 }),
  keyId: int("key_id"),
  details: text("details"), // JSON stringified details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Provider statistics for dashboard metrics
 */
export const providerStats = mysqlTable("provider_stats", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull().unique(),
  validKeyCount: int("valid_key_count").default(0).notNull(),
  totalKeyCount: int("total_key_count").default(0).notNull(),
  lastRefreshAt: timestamp("last_refresh_at"),
  activeKeyId: int("active_key_id"), // Currently rotating key
  totalRequests: int("total_requests").default(0).notNull(),
  failedRequests: int("failed_requests").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ProviderStat = typeof providerStats.$inferSelect;
export type InsertProviderStat = typeof providerStats.$inferInsert;
