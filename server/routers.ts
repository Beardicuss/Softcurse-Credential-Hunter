import { COOKIE_NAME } from "@shared/const";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getAllProviderStats,
  getDatabaseDiagnostics,
  getAllKeys,
  getAllValidKeys,
  getKeysByProvider,
  getKeyById,
  upsertApiKey,
  logAuditEvent,
  updateKeyById,
  updateProviderStats,
  getAuditLogs,
  consumeRateLimitEvent,
} from "./db";
import { TRPCError } from "@trpc/server";
import { validateKeyForProvider } from "./keyValidator";
import { buildHunterDatabaseSnapshot } from "./hunterContract";
import { buildHunterOperations } from "./hunterOperations";
import { buildLifecyclePreview, planCandidateLifecycle } from "./candidateLifecycle";
import { lifecyclePolicyFromEnv, runCandidateLifecycle } from "./runHunterLifecycle";
import {
  groupValidKeyRecords,
  toMaskedKeyRecord,
  toSafeEditAuditDetails,
} from "./keyAccess";
import { getDefaultCredentialHunterPath } from "./credentialHunterIntegration";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { authorizeLifecycleAction } from "./lifecycleActions";
import { enforceSensitiveRateLimit, type SensitiveAction } from "./sensitiveRateLimit";

async function requireSensitiveCapacity(userId: string, action: SensitiveAction) {
  const result = await enforceSensitiveRateLimit({
    userId,
    action,
    consume: consumeRateLimitEvent,
  });
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit reached for ${action}. Try again later.`,
    });
  }
}
export const appRouter = router({
  auth: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ENV.adminPassword) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "System is not configured. Missing ADMIN_PASSWORD edge variable.",
          });
        }
        if (input.password !== ENV.adminPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid access credentials",
          });
        }
        const token = await sdk.createSessionToken("local_admin", {
          name: "System Administrator",
        });
        const cookieStr = `${COOKIE_NAME}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
        ctx.resHeaders.append("Set-Cookie", cookieStr);
        return { success: true, token };
      }),
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.resHeaders.append(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;`
      );
      return {
        success: true,
      } as const;
    }),
  }),

  hunter: router({
    getStatus: publicProcedure.query(async () => {
      const database = await getDatabaseDiagnostics();
      const stats = database.connected ? await getAllProviderStats() : [];
      return {
        service: "softcurse-credential-hunter",
        status: database.connected ? "operational" as const : "degraded" as const,
        providers: stats.length,
        validKeys: stats.reduce(
          (total, item) => total + Number(item.validKeyCount || 0),
          0
        ),
        stats,
        database,
      };
    }),
    getProviderStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const stats = await getAllProviderStats();
      return stats;
    }),

    getHunterOperations: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const keys = await getAllKeys();
      const lifecyclePlan = planCandidateLifecycle(
        keys,
        new Date(),
        lifecyclePolicyFromEnv()
      );
      return {
        ...buildHunterOperations(keys),
        lifecycle: buildLifecyclePreview(
          lifecyclePlan,
          process.env.HUNTER_RETENTION_APPLY === "true"
        ),
      };
    }),
    applyLifecycleAction: protectedProcedure
      .input(z.object({
        action: z.enum(["schedule_revalidation", "cleanup"]),
        confirmation: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        await requireSensitiveCapacity(ctx.user.openId, "lifecycle_action");
        const authorization = authorizeLifecycleAction(
          input.action,
          input.confirmation,
          process.env.HUNTER_RETENTION_APPLY === "true"
        );
        if (!authorization.allowed) {
          throw new TRPCError({
            code: authorization.reason === "cleanup_disabled" ? "PRECONDITION_FAILED" : "BAD_REQUEST",
            message: authorization.reason === "cleanup_disabled"
              ? "Cleanup is disabled. Set HUNTER_RETENTION_APPLY=true on the server first."
              : "Lifecycle confirmation phrase did not match.",
          });
        }
        const result = await runCandidateLifecycle({
          apply: true,
          action: input.action,
        });
        return {
          success: true,
          action: input.action,
          totals: result.totals,
        };
      }),
    getValidKeyVault: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const keys = await getAllValidKeys();
      return {
        total: keys.length,
        providers: groupValidKeyRecords(keys),
      };
    }),
    getProviderKeys: protectedProcedure
      .input(z.object({ provider: z.string() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const keys = await getKeysByProvider(input.provider);
        return keys.map(toMaskedKeyRecord);
      }),

    revealKey: protectedProcedure
      .input(
        z.object({ provider: z.string(), keyId: z.number().int().positive() })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        await requireSensitiveCapacity(ctx.user.openId, "reveal_key");
        const key = await getKeyById(input.keyId);
        if (!key || key.provider !== input.provider)
          throw new TRPCError({ code: "NOT_FOUND" });
        await logAuditEvent("key_revealed", key.provider, key.id, {
          access: "admin_dashboard",
        });
        return { id: key.id, keyValue: key.keyValue };
      }),

    auditKeyCopy: protectedProcedure
      .input(
        z.object({ provider: z.string(), keyId: z.number().int().positive() })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        await requireSensitiveCapacity(ctx.user.openId, "copy_key");
        const key = await getKeyById(input.keyId);
        if (!key || key.provider !== input.provider)
          throw new TRPCError({ code: "NOT_FOUND" });
        await logAuditEvent("key_copied", key.provider, key.id, {
          access: "admin_dashboard",
        });
        return { success: true };
      }),
    validateKey: protectedProcedure
      .input(z.object({ provider: z.string(), keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await requireSensitiveCapacity(ctx.user.openId, "validate_key");
        const keys = await getKeysByProvider(input.provider);
        const key = keys.find(k => k.id === input.keyId);
        if (!key) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const validity = await validateKeyForProvider(
          input.provider,
          key.keyValue
        );
        await upsertApiKey(input.provider, key.keyValue, validity);
        await logAuditEvent("key_validated", input.provider, input.keyId, {
          validity,
        });
        return { id: input.keyId, validity };
      }),

    validateAllKeysForProvider: protectedProcedure
      .input(z.object({ provider: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await requireSensitiveCapacity(ctx.user.openId, "validate_provider");
        const keys = await getKeysByProvider(input.provider);
        const results = { valid: 0, invalid: 0, rateLimited: 0 };
        for (const key of keys) {
          const validity = await validateKeyForProvider(
            input.provider,
            key.keyValue
          );
          await upsertApiKey(input.provider, key.keyValue, validity);
          if (validity === "valid") results.valid++;
          else if (validity === "invalid") results.invalid++;
          else if (validity === "rate_limited") results.rateLimited++;
        }
        await logAuditEvent(
          "refresh_completed",
          input.provider,
          undefined,
          results
        );
        return results;
      }),

    addKey: protectedProcedure
      .input(
        z.object({
          provider: z.string(),
          keyValue: z.string().min(1),
          validity: z
            .enum(["valid", "invalid", "rate_limited", "unknown"])
            .default("unknown"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await upsertApiKey(input.provider, input.keyValue, input.validity);
        await logAuditEvent("key_added_manually", input.provider, undefined, {
          validity: input.validity,
        });
        return { success: true };
      }),

    editKey: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          provider: z.string(),
          keyValue: z.string().optional(),
          validity: z
            .enum(["valid", "invalid", "rate_limited", "unknown"])
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await updateKeyById(input.id, {
          keyValue: input.keyValue,
          validity: input.validity,
        });
        await logAuditEvent(
          "key_edited_manually",
          input.provider,
          input.id,
          toSafeEditAuditDetails(input)
        );
        return { success: true };
      }),

    addProvider: protectedProcedure
      .input(z.object({ provider: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        await updateProviderStats(input.provider);
        return { success: true };
      }),

    getAuditLogs: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      return await getAuditLogs();
    }),

    getHunterSnapshot: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const [stats, keys] = await Promise.all([
        getAllProviderStats(),
        getAllKeys(),
      ]);
      return buildHunterDatabaseSnapshot(stats, keys);
    }),
  }),
});

export type AppRouter = typeof appRouter;
