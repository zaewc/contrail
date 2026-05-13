import 'dotenv/config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getGitHubStats } from './github.js';
import { getCached, setCached } from './cache.js';
import { renderStatsSvg } from './svg.js';
import type { GitHubStats } from './types.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '21600', 10);
const statsCacheKey = (login: string) =>
  `github:stats:${login.toLowerCase()}:v4`;
const svgCacheKey = (login: string) => `svg:${login.toLowerCase()}:v2`;
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

// Stats endpoint
fastify.get<{ Params: { login: string } }>(
  '/api/users/:login/stats',
  async (request, reply) => {
    const { login } = request.params;

    // Check cache
    const cached = getCached(statsCacheKey(login));
    if (cached) {
      return cached;
    }

    try {
      const key = statsCacheKey(login);
      const pending = pendingStatsRequests.get(key);
      const stats =
        pending ??
        getGitHubStats(login).finally(() => {
          pendingStatsRequests.delete(key);
        });

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

// SVG card endpoint
fastify.get<{ Params: { login: string } }>(
  '/api/users/:login/card.svg',
  async (request, reply) => {
    const { login } = request.params;

    // Check cache
    const cached = getCached(svgCacheKey(login));
    if (cached) {
      reply
        .type('image/svg+xml')
        .header('Cache-Control', `public, max-age=${CACHE_TTL}`);
      return cached;
    }

    try {
      const cachedStats = getCached<GitHubStats>(statsCacheKey(login));
      const stats = cachedStats ?? (await getGitHubStats(login));
      if (!cachedStats) {
        setCached(statsCacheKey(login), stats, CACHE_TTL);
      }
      const svg = renderStatsSvg(stats);

      // Cache the result
      setCached(svgCacheKey(login), svg, CACHE_TTL);

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
