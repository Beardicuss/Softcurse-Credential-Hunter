import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from '../../server/routers';
import { createContext } from '../../server/_core/context';
import { aiProviderService } from '../../server/aiProviderService';
import { getAllProviderStats, getAuditLogs, getKeysByProvider, logAuditEvent } from '../../server/db';
import { cors } from 'hono/cors';
import { ENV } from '../../server/_core/env';

const app = new Hono().basePath('/api');

app.use('*', async (c, next) => {
    if (c.env) {
        (globalThis as any).__PAGES_ENV__ = c.env;
    }
    if (c.env && typeof process !== 'undefined') {
        Object.assign(process.env, c.env);
    }
    await next();
});

app.use('*', cors());

app.post('/chess-ai', async (c) => {
    try {
        const body = await c.req.json();
        const { fen, moveHistory, difficulty } = body;

        if (!fen || typeof fen !== 'string') {
            return c.json({
                move: '',
                provider: '',
                error: 'Missing or invalid FEN string',
            }, 400);
        }

        const response = await aiProviderService.getMoveFromAI({
            fen,
            moveHistory,
            difficulty,
        });

        return c.json(response);
    } catch (error) {
        console.error('[Chess AI Endpoint] Error:', error);

        await logAuditEvent('fallback_triggered', undefined, undefined, {
            error: (error as Error).message,
        });

        return c.json({
            move: '',
            provider: '',
            error: `All AI providers failed: ${(error as Error).message}`,
        }, 503);
    }
});

app.get('/chess-ai/status', async (c) => {
    try {
        const response = await aiProviderService.getMoveFromAI({
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            moveHistory: [],
        });

        return c.json({
            currentProvider: aiProviderService.getCurrentProvider(),
            providerChain: aiProviderService.getProviderChain(),
            lastTestMove: response.move,
            status: 'operational',
        });
    } catch (error) {
        return c.json({
            currentProvider: aiProviderService.getCurrentProvider(),
            providerChain: aiProviderService.getProviderChain(),
            status: 'degraded',
            error: (error as Error).message,
        }, 503);
    }
});

app.get('/hunter/provider-stats', async (c) => {
    if (!isBridgeAuthorized(c.req.header('authorization'), c.req.header('x-hex-token'))) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const stats = await getAllProviderStats();
    return c.json({ success: true, stats });
});

app.get('/hunter/audit', async (c) => {
    if (!isBridgeAuthorized(c.req.header('authorization'), c.req.header('x-hex-token'))) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || '20') || 20));
    const logs = await getAuditLogs();
    return c.json({ success: true, logs: logs.slice(0, limit) });
});

app.get('/hunter/key-summary', async (c) => {
    if (!isBridgeAuthorized(c.req.header('authorization'), c.req.header('x-hex-token'))) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const providers = ['OpenAI', 'Anthropic', 'Google Gemini', 'xAI', 'Mistral', 'Cohere', 'Groq', 'OpenRouter'];
    const keysByProvider = await Promise.all(providers.map(async (provider) => ({
        provider,
        keys: await getKeysByProvider(provider),
    })));

    const providerSummary = keysByProvider.flatMap(({ provider, keys }) => {
        const counts = new Map<string, number>();
        for (const key of keys) {
            const validity = String(key.validity || 'unknown');
            counts.set(validity, (counts.get(validity) || 0) + 1);
        }
        return Array.from(counts.entries()).map(([validity, count]) => ({ provider, validity, count }));
    });

    const allKeys = keysByProvider.flatMap((entry) => entry.keys);
    const totals = {
        total_keys: allKeys.length,
        valid_keys: allKeys.filter((key) => key.validity === 'valid').length,
        invalid_keys: allKeys.filter((key) => key.validity === 'invalid').length,
        unknown_keys: allKeys.filter((key) => key.validity === 'unknown').length,
        rate_limited_keys: allKeys.filter((key) => key.validity === 'rate_limited').length,
    };

    return c.json({
        success: true,
        summary: {
            totals,
            providers: providerSummary,
        },
    });
});

app.get('/hunter/valid-keys', async (c) => {
    if (!isBridgeAuthorized(c.req.header('authorization'), c.req.header('x-hex-token'))) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const providers = ['OpenAI', 'Anthropic', 'Google Gemini', 'xAI', 'Mistral', 'Cohere', 'Groq', 'OpenRouter'];
    const keysByProvider = await Promise.all(providers.map(async (provider) => ({
        provider,
        keys: await getKeysByProvider(provider),
    })));

    const mapped = {} as Record<string, string[]>;
    for (const { provider, keys } of keysByProvider) {
        const validKeys = keys
            .filter((key) => key.validity === 'valid' && key.keyValue)
            .map((key) => String(key.keyValue));
        if (validKeys.length > 0) {
            mapped[provider] = Array.from(new Set(validKeys));
        }
    }

    return c.json({ success: true, keys: mapped });
});

app.use('/trpc/*', trpcServer({
    router: appRouter,
    createContext: createContext,
}));

function isBridgeAuthorized(authorizationHeader?: string, altTokenHeader?: string) {
    const expected = ENV.hexBridgeToken;
    if (!expected) return false;

    const auth = authorizationHeader || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const alt = String(altTokenHeader || '').trim();
    return bearer === expected || alt === expected;
}

export const onRequest = handle(app);

