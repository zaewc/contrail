import { githubRest } from './githubClient.js';
const LANGUAGE_CONCURRENCY = 8;
export async function analyzeTechStack(repositories) {
    const languageBytes = new Map();
    const languageRepositoryCount = new Map();
    for (let i = 0; i < repositories.length; i += LANGUAGE_CONCURRENCY) {
        const batch = repositories.slice(i, i + LANGUAGE_CONCURRENCY);
        const results = await Promise.allSettled(batch.map((repo) => githubRest(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/languages`)));
        results.forEach((result) => {
            if (result.status !== 'fulfilled') {
                return;
            }
            const languages = result.value;
            for (const [language, bytes] of Object.entries(languages)) {
                languageBytes.set(language, (languageBytes.get(language) ?? 0) + bytes);
                languageRepositoryCount.set(language, (languageRepositoryCount.get(language) ?? 0) + 1);
            }
        });
    }
    const totalBytes = [...languageBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
    return [...languageBytes.entries()]
        .map(([name, bytes]) => ({
        name,
        bytes,
        percentage: totalBytes === 0 ? 0 : (bytes / totalBytes) * 100,
        repositories: languageRepositoryCount.get(name) ?? 0,
    }))
        .sort((a, b) => b.bytes - a.bytes);
}
