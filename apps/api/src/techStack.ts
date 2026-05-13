import { githubRest } from './githubClient.js';
import { ContributedRepository, TechStackItem } from './types.js';

const LANGUAGE_CONCURRENCY = 8;
const DEFAULT_LANGUAGE_REPOSITORY_LIMIT = 20;

function getLanguageRepositoryLimit(): number {
  const value = Number(process.env.TECH_STACK_REPOSITORY_LIMIT);
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_LANGUAGE_REPOSITORY_LIMIT;
}

export async function analyzeTechStack(
  repositories: ContributedRepository[]
): Promise<TechStackItem[]> {
  const languageBytes = new Map<string, number>();
  const languageRepositoryCount = new Map<string, number>();
  const targetRepositories = repositories.slice(0, getLanguageRepositoryLimit());

  for (let i = 0; i < targetRepositories.length; i += LANGUAGE_CONCURRENCY) {
    const batch = targetRepositories.slice(i, i + LANGUAGE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((repo) =>
        githubRest<Record<string, number>>(
          `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/languages`
        )
      )
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
