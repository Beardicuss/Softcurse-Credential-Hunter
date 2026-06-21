export const getEnvVar = (key: string) => {
  if (typeof (globalThis as any).__PAGES_ENV__ !== "undefined") {
    return (globalThis as any).__PAGES_ENV__[key];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const ENV = {
  get appId() {
    return getEnvVar("VITE_APP_ID") ?? "";
  },
  get cookieSecret() {
    return getEnvVar("JWT_SECRET") ?? "";
  },
  get adminPassword() {
    return getEnvVar("ADMIN_PASSWORD") ?? "";
  },
  get databaseUrl() {
    return getEnvVar("DATABASE_URL") ?? "";
  },
  get oAuthServerUrl() {
    return getEnvVar("OAUTH_SERVER_URL") ?? "";
  },
  get ownerOpenId() {
    return getEnvVar("OWNER_OPEN_ID") ?? "";
  },
  get isProduction() {
    return getEnvVar("NODE_ENV") === "production";
  },
  get forgeApiUrl() {
    return getEnvVar("BUILT_IN_FORGE_API_URL") ?? "";
  },
  get forgeApiKey() {
    return getEnvVar("BUILT_IN_FORGE_API_KEY") ?? "";
  },
  get hexBridgeToken() {
    return getEnvVar("HEX_BRIDGE_TOKEN") ?? "";
  },
  get corsAllowedOrigins() {
    return getEnvVar("CORS_ALLOWED_ORIGINS") ?? "";
  },
};
