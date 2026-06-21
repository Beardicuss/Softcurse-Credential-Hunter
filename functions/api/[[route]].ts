import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";
import {
  getAllProviderStats,
  getAuditLogs,
  getKeysByProvider,
} from "../../server/db";
import { ENV } from "../../server/_core/env";
import { authorizeBridgeToken } from "../../server/bridgeAuth";

const app = new Hono().basePath("/api");

app.use("*", async (c, next) => {
  if (c.env) {
    (globalThis as any).__PAGES_ENV__ = c.env;
  }
  if (c.env && typeof process !== "undefined") {
    Object.assign(process.env, c.env);
  }
  await next();
});

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const ownOrigin = new URL(c.req.url).origin;
      const allowed = ENV.corsAllowedOrigins
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean);
      return origin === ownOrigin || allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "x-hex-token"],
    credentials: true,
    maxAge: 600,
  })
);

app.get("/hunter/status", async c => {
  if (
    !(await isBridgeAuthorized(
      c.req.header("authorization"),
      c.req.header("x-hex-token")
    ))
  ) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const stats = await getAllProviderStats();
  return c.json({
    success: true,
    service: "softcurse-credential-hunter",
    providers: stats.length,
    validKeys: stats.reduce(
      (total, item) => total + Number(item.validKeyCount || 0),
      0
    ),
  });
});

app.get("/hunter/provider-stats", async c => {
  if (
    !(await isBridgeAuthorized(
      c.req.header("authorization"),
      c.req.header("x-hex-token")
    ))
  ) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  return c.json({ success: true, stats: await getAllProviderStats() });
});

app.get("/hunter/audit", async c => {
  if (
    !(await isBridgeAuthorized(
      c.req.header("authorization"),
      c.req.header("x-hex-token")
    ))
  ) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const limit = Math.max(
    1,
    Math.min(100, Number(c.req.query("limit") || "20") || 20)
  );
  const logs = await getAuditLogs();
  return c.json({ success: true, logs: logs.slice(0, limit) });
});

app.get("/hunter/key-summary", async c => {
  if (
    !(await isBridgeAuthorized(
      c.req.header("authorization"),
      c.req.header("x-hex-token")
    ))
  ) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const keysByProvider = await loadProviderKeys();
  const providers = keysByProvider.flatMap(({ provider, keys }) => {
    const counts = new Map<string, number>();
    for (const key of keys) {
      const validity = String(key.validity || "unknown");
      counts.set(validity, (counts.get(validity) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([validity, count]) => ({
      provider,
      validity,
      count,
    }));
  });
  const allKeys = keysByProvider.flatMap(entry => entry.keys);

  return c.json({
    success: true,
    summary: {
      totals: {
        total_keys: allKeys.length,
        valid_keys: allKeys.filter(key => key.validity === "valid").length,
        invalid_keys: allKeys.filter(key => key.validity === "invalid").length,
        unknown_keys: allKeys.filter(key => key.validity === "unknown").length,
        rate_limited_keys: allKeys.filter(
          key => key.validity === "rate_limited"
        ).length,
      },
      providers,
    },
  });
});

app.get("/hunter/valid-keys", async c => {
  if (
    !(await isBridgeAuthorized(
      c.req.header("authorization"),
      c.req.header("x-hex-token")
    ))
  ) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const mapped: Record<string, string[]> = {};
  for (const { provider, keys } of await loadProviderKeys()) {
    const validKeys = keys
      .filter(key => key.validity === "valid" && key.keyValue)
      .map(key => String(key.keyValue));
    if (validKeys.length) mapped[provider] = Array.from(new Set(validKeys));
  }
  return c.json({ success: true, keys: mapped });
});

app.use("/trpc/*", trpcServer({ router: appRouter, createContext }));

async function loadProviderKeys() {
  const stats = await getAllProviderStats();
  const providers = Array.from(
    new Set(stats.map(item => String(item.provider)).filter(Boolean))
  );
  return Promise.all(
    providers.map(async provider => ({
      provider,
      keys: await getKeysByProvider(provider),
    }))
  );
}

async function isBridgeAuthorized(
  authorizationHeader?: string,
  alternateHeader?: string
) {
  return authorizeBridgeToken(
    ENV.hexBridgeToken,
    authorizationHeader,
    alternateHeader
  );
}
export const onRequest = handle(app);
