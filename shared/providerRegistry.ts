export type ProviderCapability = {
  canonical: string;
  aliases: string[];
  supportsValidation?: boolean;
  supportsAiRouting?: boolean;
  fallbackPriority?: number;
};

export const PROVIDER_REGISTRY: ProviderCapability[] = [
  { canonical: "OpenAI", aliases: ["openai"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 50 },
  { canonical: "Anthropic", aliases: ["anthropic", "claude"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 45 },
  { canonical: "Google Gemini", aliases: ["gemini", "google gemini", "google", "google ai"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 40 },
  { canonical: "xAI", aliases: ["xai", "xai / grok", "grok"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 35 },
  { canonical: "OpenRouter", aliases: ["openrouter"], supportsValidation: false, supportsAiRouting: true, fallbackPriority: 34 },
  { canonical: "Mistral", aliases: ["mistral"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 30 },
  { canonical: "Cohere", aliases: ["cohere"], supportsValidation: true, supportsAiRouting: true, fallbackPriority: 25 },
  { canonical: "Hugging Face", aliases: ["hugging face", "huggingface", "hf"], supportsValidation: false, supportsAiRouting: false, fallbackPriority: 20 },
  { canonical: "Together AI", aliases: ["together ai", "together"], supportsValidation: false, supportsAiRouting: false, fallbackPriority: 18 },
  { canonical: "Replicate", aliases: ["replicate"], supportsValidation: false, supportsAiRouting: false, fallbackPriority: 16 },
  { canonical: "AWS", aliases: ["aws"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "AWS Secret", aliases: ["aws secret"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "AWS Pair", aliases: ["aws pair"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure", aliases: ["azure"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure Client ID", aliases: ["azure client id"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure Client Secret", aliases: ["azure client secret"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure Tenant ID", aliases: ["azure tenant id"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure Hex", aliases: ["azure hex"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Azure Pair", aliases: ["azure pair"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Stripe", aliases: ["stripe"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Twilio", aliases: ["twilio"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Twilio SID", aliases: ["twilio sid"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Twilio Token", aliases: ["twilio token"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Twilio Bare Token", aliases: ["twilio bare token"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Twilio Pair", aliases: ["twilio pair"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "GitHub PAT", aliases: ["github pat", "github token"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "JWT", aliases: ["jwt"], supportsValidation: false, supportsAiRouting: false },
  { canonical: "Generic Secret", aliases: ["generic secret", "derived secret", "custom secret"], supportsValidation: false, supportsAiRouting: false },
];

function simplifyProviderName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-/]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeProviderName(value: string): string {
  const simplified = simplifyProviderName(value);
  if (!simplified) return String(value || "").trim();

  for (const provider of PROVIDER_REGISTRY) {
    if (simplifyProviderName(provider.canonical) === simplified) return provider.canonical;
    if (provider.aliases.some((alias) => simplifyProviderName(alias) === simplified)) {
      return provider.canonical;
    }
  }

  return String(value || "").trim();
}

export function getProviderCapability(value: string): ProviderCapability | undefined {
  const canonical = normalizeProviderName(value);
  return PROVIDER_REGISTRY.find((provider) => provider.canonical === canonical);
}

export function getAiProviderChain(): string[] {
  return PROVIDER_REGISTRY
    .filter((provider) => provider.supportsAiRouting)
    .sort((a, b) => (b.fallbackPriority || 0) - (a.fallbackPriority || 0))
    .map((provider) => provider.canonical);
}

export function canValidateProvider(value: string): boolean {
  return !!getProviderCapability(value)?.supportsValidation;
}
