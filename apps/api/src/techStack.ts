import { githubRest } from './githubClient.js';
import { ContributedRepository, TechStackItem } from './types.js';

export async function analyzeTechStack(
  repositories: ContributedRepository[]
): Promise<TechStackItem[]> {
  const languageBytes = new Map<string, number>();
  const languageRepositoryCount = new Map<string, number>();

  for (const repo of repositories) {
    try {
      const languages = await githubRest<Record<string, number>>(
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/languages`
      );

      for (const [language, bytes] of Object.entries(languages)) {
        languageBytes.set(language, (languageBytes.get(language) ?? 0) + bytes);
        languageRepositoryCount.set(
          language,
          (languageRepositoryCount.get(language) ?? 0) + 1
        );
      }
    } catch {
      continue;
    }
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
