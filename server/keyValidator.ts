/**
 * Key Validator
 * Validates API keys for each provider via a registry-based dispatch.
 */

import { canValidateProvider, normalizeProviderName } from "../shared/providerRegistry";

type ValidityStatus = "valid" | "invalid" | "rate_limited" | "unknown";
type Validator = (key: string) => Promise<ValidityStatus>;

export async function validateOpenAIKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function validateAnthropicKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok || response.status === 400) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function validateGoogleGeminiKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "test" }] }],
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (response.status === 401 || response.status === 403) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function validateXAIKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function validateMistralKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function validateCohereKey(key: string): Promise<ValidityStatus> {
  try {
    const response = await fetch("https://api.cohere.com/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-r",
        prompt: "test",
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return "invalid";
    if (response.status === 429) return "rate_limited";
    if (response.ok) return "valid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

const VALIDATORS: Record<string, Validator> = {
  "OpenAI": validateOpenAIKey,
  "Anthropic": validateAnthropicKey,
  "Google Gemini": validateGoogleGeminiKey,
  "xAI": validateXAIKey,
  "Mistral": validateMistralKey,
  "Cohere": validateCohereKey,
};

export async function validateKeyForProvider(provider: string, key: string): Promise<ValidityStatus> {
  const normalized = normalizeProviderName(provider);
  if (!canValidateProvider(normalized)) {
    return "unknown";
  }

  const validator = VALIDATORS[normalized];
  if (!validator) {
    return "unknown";
  }

  return validator(key);
}
