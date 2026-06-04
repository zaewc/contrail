import { githubRest } from './githubClient.js';
import { getCached, setCached } from './cache.js';
import { ContributedRepository, TechStackItem } from './types.js';

// A repository's language byte breakdown changes slowly, so cache it per repo
// with a long TTL. This makes repeated/incremental requests near-instant and
// lets the higher fan-out below stay cheap on warm caches.
const LANGUAGE_CONCURRENCY = parseInt(
  process.env.LANGUAGE_CONCURRENCY || '16',
  10
);
const LANGUAGE_CACHE_TTL = parseInt(
  process.env.LANGUAGE_CACHE_TTL || '604800',
  10
);

const languagesCacheKey = (owner: string, name: string) =>
  `github:languages:${owner.toLowerCase()}/${name.toLowerCase()}:v1`;

async function fetchRepositoryLanguages(
  repo: ContributedRepository
): Promise<Record<string, number>> {
  const key = languagesCacheKey(repo.owner, repo.name);
  const cached = getCached<Record<string, number>>(key);
  if (cached) {
    return cached;
  }
  const languages = await githubRest<Record<string, number>>(
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/languages`
  );
  setCached(key, languages, LANGUAGE_CACHE_TTL);
  return languages;
}

export async function analyzeTechStack(
  repositories: ContributedRepository[]
): Promise<TechStackItem[]> {
  const languageBytes = new Map<string, number>();
  const languageRepositoryCount = new Map<string, number>();
  const targetRepositories = repositories;

  for (let i = 0; i < targetRepositories.length; i += LANGUAGE_CONCURRENCY) {
    const batch = targetRepositories.slice(i, i + LANGUAGE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((repo) => fetchRepositoryLanguages(repo))
    );

    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        return;
      }
      const languages = result.value;
      for (const [language, bytes] of Object.entries(languages)) {
        languageBytes.set(language, (languageBytes.get(language) ?? 0) + bytes);
        languageRepositoryCount.set(
          language,
          (languageRepositoryCount.get(language) ?? 0) + 1
        );
      }
    });
  }

  const totalBytes = [...languageBytes.values()].reduce(
    (sum, bytes) => sum + bytes,
    0
  );

  return [...languageBytes.entries()]
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes === 0 ? 0 : (bytes / totalBytes) * 100,
      repositories: languageRepositoryCount.get(name) ?? 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}
