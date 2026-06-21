import { COOKIE_NAME } from "@shared/const";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getAllProviderStats,
  getKeysByProvider,
  upsertApiKey,
  logAuditEvent,
  updateKeyById,
  updateProviderStats,
  getAuditLogs,
} from "./db";
import { TRPCError } from "@trpc/server";
import { validateKeyForProvider } from "./keyValidator";
import { buildHunterContractSnapshot, readHunterOutputSnapshot } from "./hunterContract";
import { getDefaultCredentialHunterPath } from "./credentialHunterIntegration";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

export const appRouter = router({
  auth: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ENV.adminPassword) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "System is not configured. Missing ADMIN_PASSWORD edge variable." });
        }
        if (input.password !== ENV.adminPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid access credentials" });
        }
        const token = await sdk.createSessionToken("local_admin", { name: "System Administrator" });
        const cookieStr = `${COOKIE_NAME}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
        ctx.resHeaders.append('Set-Cookie', cookieStr);
        return { success: true, token };
      }),
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.resHeaders.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;`);
      return {
        success: true,
      } as const;
    }),
  }),

  hunter: router({
    getStatus: publicProcedure.query(async () => {
      const stats = await getAllProviderStats();
      return {
        service: "softcurse-credential-hunter",
        status: "operational" as const,
        providers: stats?.length || 0,
        validKeys: stats?.reduce((total, item) => total + Number(item.validKeyCount || 0), 0) || 0,
        stats: stats || [],
      };
    }),
    getProviderStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const stats = await getAllProviderStats();
      return stats;
    }),

    getProviderKeys: protectedProcedure
      .input(z.object({ provider: z.string() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const keys = await getKeysByProvider(input.provider);
        return keys.map((k) => ({
          id: k.id,
          provider: k.provider,
          keyMasked: k.keyMasked,
          keyValue: k.keyValue,
          validity: k.validity,
          lastCheckedAt: k.lastCheckedAt,
          usageCount: k.usageCount,
        }));
      }),

    validateKey: protectedProcedure
      .input(z.object({ provider: z.string(), keyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const keys = await getKeysByProvider(input.provider);
        const key = keys.find((k) => k.id === input.keyId);
        if (!key) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const validity = await validateKeyForProvider(input.provider, key.keyValue);
        await upsertApiKey(input.provider, key.keyValue, validity);
        await logAuditEvent("key_validated", input.provider, input.keyId, { validity });
        return { id: input.keyId, validity };
      }),

    validateAllKeysForProvider: protectedProcedure
      .input(z.object({ provider: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const keys = await getKeysByProvider(input.provider);
        const results = { valid: 0, invalid: 0, rateLimited: 0 };
        for (const key of keys) {
          const validity = await validateKeyForProvider(input.provider, key.keyValue);
          await upsertApiKey(input.provider, key.keyValue, validity);
          if (validity === "valid") results.valid++;
          else if (validity === "invalid") results.invalid++;
          else if (validity === "rate_limited") results.rateLimited++;
        }
        await logAuditEvent("refresh_completed", input.provider, undefined, results);
        return results;
      }),

    addKey: protectedProcedure
      .input(
        z.object({
          provider: z.string(),
          keyValue: z.string().min(1),
          validity: z.enum(["valid", "invalid", "rate_limited", "unknown"]).default("unknown"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await upsertApiKey(input.provider, input.keyValue, input.validity);
        await logAuditEvent("key_added_manually", input.provider, undefined, { validity: input.validity });
        return { success: true };
      }),

    editKey: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          provider: z.string(),
          keyValue: z.string().optional(),
          validity: z.enum(["valid", "invalid", "rate_limited", "unknown"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await updateKeyById(input.id, {
          keyValue: input.keyValue,
          validity: input.validity
        });
        await logAuditEvent("key_edited_manually", input.provider, input.id, { updates: input });
        return { success: true };
      }),

    addProvider: protectedProcedure
      .input(z.object({ provider: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await updateProviderStats(input.provider);
        return { success: true };
      }),

    getAuditLogs: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return await getAuditLogs();
    }),

    getHunterSnapshot: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const payload = readHunterOutputSnapshot(getDefaultCredentialHunterPath());
      if (!payload) {
        return {
          contractVersion: "hunter.v1",
          generatedAt: null,
          totals: { candidates: 0, confirmedKeys: 0, confirmedCommits: 0, providers: 0 },
          freshness: { fresh: 0, warm: 0, stale: 0, revalidationSuggested: 0 },
          validation: { valid: 0, invalid: 0, unknown: 0, byTier: { high: 0, medium: 0, low: 0, unknown: 0 } },
          providers: [],
          failedQueries: [],
        };
      }
      return buildHunterContractSnapshot(payload);
    }),
  }),
});

export type AppRouter = typeof appRouter;
