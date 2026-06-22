import crypto from "node:crypto";

export interface SensitiveLimit {
  limit: number;
  windowMs: number;
}

export const SENSITIVE_LIMITS = {
  reveal_key: { limit: 30, windowMs: 60_000 },
  copy_key: { limit: 60, windowMs: 60_000 },
  validate_key: { limit: 30, windowMs: 60_000 },
  validate_provider: { limit: 5, windowMs: 600_000 },
  lifecycle_action: { limit: 3, windowMs: 3_600_000 },
} as const satisfies Record<string, SensitiveLimit>;

export type SensitiveAction = keyof typeof SENSITIVE_LIMITS;

export function buildRateLimitScope(userId: string, action: SensitiveAction) {
  const actorHash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 16);
  return `${action}:${actorHash}`;
}

export async function enforceSensitiveRateLimit(options: {
  userId: string;
  action: SensitiveAction;
  consume: (scope: string, limit: number, windowMs: number) => Promise<boolean>;
}) {
  const policy = SENSITIVE_LIMITS[options.action];
  const scope = buildRateLimitScope(options.userId, options.action);
  const allowed = await options.consume(scope, policy.limit, policy.windowMs);
  return {
    allowed,
    action: options.action,
    limit: policy.limit,
    windowMs: policy.windowMs,
  };
}
