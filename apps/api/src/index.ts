import 'dotenv/config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getGitHubStats, getTechStack } from './github.js';
import { getCached, setCached } from './cache.js';
import { renderStatsSvg, resolveCardTheme, type CardTheme } from './svg.js';
import type { GitHubStats, TechStackItem } from './types.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '21600', 10);
const DEFAULT_INCREMENTAL_COMMIT_LIMIT = 100;
const MAX_INCREMENTAL_COMMIT_LIMIT = 10000;
const statsCacheKey = (login: string, commitLimit: number | null = DEFAULT_INCREMENTAL_COMMIT_LIMIT) =>
  `github:stats:${login.toLowerCase()}:v9:commitLimit:${commitLimit ?? 'all'}`;
const svgCacheKey = (login: string, theme: CardTheme = 'dark') =>
  `svg:${login.toLowerCase()}:${theme}:v4`;
const pendingStatsRequests = new Map<string, Promise<GitHubStats>>();

const fastify = Fastify({
  logger: true,
});

// Register CORS
await fastify.register(cors, {
  origin: true,
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

function parseCommitLimit(value: unknown): number | null {
  if (value === 'all') {
    return null;
  }
  if (typeof value !== 'string') {
    return DEFAULT_INCREMENTAL_COMMIT_LIMIT;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_INCREMENTAL_COMMIT_LIMIT;
  }
  return Math.min(limit, MAX_INCREMENTAL_COMMIT_LIMIT);
}

// Stats endpoint
fastify.get<{ Params: { login: string }; Querystring: { commitLimit?: string } }>(
  '/api/users/:login/stats',
  async (request, reply) => {
    const { login } = request.params;
    const commitLimit = parseCommitLimit(request.query.commitLimit);
    const key = statsCacheKey(login, commitLimit);

    // Check cache
    const cached = getCached(key);
    if (cached) {
      return cached;
    }

    try {
      const pending = pendingStatsRequests.get(key);
      const stats =
        pending ??
        getGitHubStats(login, { commitLimit, includeTechStack: false }).finally(
          () => {
            pendingStatsRequests.delete(key);
          }
        );

      if (!pending) {
        pendingStatsRequests.set(key, stats);
      }

      const resolvedStats = await stats;

      // Cache the result
      setCached(key, resolvedStats, CACHE_TTL);

      return resolvedStats;
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      if (error.message === 'INVALID_LOGIN') {
        reply.code(400).send({ error: 'Invalid login' });
        return;
      }
      if (error.message === 'GITHUB_TOKEN' || error.message.includes('is not set')) {
        reply.code(500).send({ error: 'GitHub token not configured' });
        return;
      }
      if (
        error.message === 'GITHUB_API_ERROR' ||
        error.message.includes('rate limit')
      ) {
        reply.code(502).send({ error: 'GitHub API error' });
        return;
      }
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }
);

// Tech-stack endpoint (loaded separately from /stats by the web client)
const techStackCacheKey = (login: string) =>
  `github:techstack:response:${login.toLowerCase()}:v1`;
const pendingTechStackRequests = new Map<string, Promise<TechStackItem[]>>();

fastify.get<{ Params: { login: string } }>(
  '/api/users/:login/techstack',
  async (request, reply) => {
    const { login } = request.params;
    const key = techStackCacheKey(login);

    const cached = getCached<TechStackItem[]>(key);
    if (cached) {
      return { techStack: cached };
    }

    try {
      const pending = pendingTechStackRequests.get(key);
      const promise =
        pending ??
        getTechStack(login).finally(() => {
          pendingTechStackRequests.delete(key);
        });

      if (!pending) {
        pendingTechStackRequests.set(key, promise);
      }

      const techStack = await promise;
      setCached(key, techStack, CACHE_TTL);
      return { techStack };
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      if (error.message === 'INVALID_LOGIN') {
        reply.code(400).send({ error: 'Invalid login' });
        return;
      }
      if (
        error.message === 'GITHUB_API_ERROR' ||
        error.message.includes('rate limit')
      ) {
        reply.code(502).send({ error: 'GitHub API error' });
        return;
      }
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }
);

// SVG card endpoint
fastify.get<{ Params: { login: string }; Querystring: { theme?: string } }>(
  '/api/users/:login/card.svg',
  async (request, reply) => {
    const { login } = request.params;
    const theme = resolveCardTheme(request.query.theme);

    // Check cache
    const cached = getCached(svgCacheKey(login, theme));
    if (cached) {
      reply
        .type('image/svg+xml')
        .header('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return cached;
    }

    try {
      // The card reports lifetime line counts, so it must analyze every commit
      // in the window (commitLimit: null) rather than the incremental sample the
      // dashboard uses — otherwise additions/deletions only cover ~100 commits.
      const cachedStats = getCached<GitHubStats>(statsCacheKey(login, null));
      const stats = cachedStats ?? (await getGitHubStats(login, {
        commitLimit: null,
        includeTechStack: false,
      }));
      if (!cachedStats) {
        setCached(statsCacheKey(login, null), stats, CACHE_TTL);
      }
      const svg = renderStatsSvg(stats, theme);

      // Cache the result
      setCached(svgCacheKey(login, theme), svg, CACHE_TTL);

      reply
        .type('image/svg+xml')
        .header('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return svg;
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        reply.code(404).send('User not found');
        return;
      }
      if (error.message === 'INVALID_LOGIN') {
        reply.code(400).send('Invalid login');
        return;
      }
      if (error.message === 'GITHUB_TOKEN' || error.message.includes('is not set')) {
        reply.code(500).send('GitHub token not configured');
        return;
      }
      if (
        error.message === 'GITHUB_API_ERROR' ||
        error.message.includes('rate limit')
      ) {
        reply.code(502).send('GitHub API error');
        return;
      }
      fastify.log.error(error);
      reply.code(500).send('Internal server error');
    }
  }
);

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on http://0.0.0.0:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
