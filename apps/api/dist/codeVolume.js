import { classifyRestError, githubRest } from './githubClient.js';
import { languageForFilename, shouldExcludeFromCodeVolume } from './language.js';
export const DEFAULT_CODE_VOLUME_YEARS = 1;
export const DEFAULT_COMMIT_LIMIT = 500;
export const MAX_COMMIT_LIMIT = 1000;
export const DEFAULT_REPOSITORY_LIMIT = 50;
export const MAX_REPOSITORY_LIMIT = 100;
function emptyStats(options) {
    return {
        scope: {
            years: options.years,
            commitLimit: options.commitLimit,
            repositoryLimit: options.repositoryLimit,
            isPartial: false,
        },
        summary: {
            commitsAnalyzed: 0,
            repositoriesAnalyzed: 0,
            filesChanged: 0,
            additions: 0,
            deletions: 0,
            changes: 0,
        },
        byLanguage: [],
        skippedRepositories: [],
        commitCountsByRepository: {},
    };
}
export async function analyzeCodeVolume(login, repositories, options) {
    const safeOptions = {
        years: Math.max(1, options.years),
        commitLimit: Math.min(options.commitLimit, MAX_COMMIT_LIMIT),
        repositoryLimit: Math.min(options.repositoryLimit, MAX_REPOSITORY_LIMIT),
    };
    const stats = emptyStats(safeOptions);
    const languageMap = new Map();
    const since = new Date();
    since.setFullYear(since.getFullYear() - safeOptions.years);
    const targetRepositories = repositories.slice(0, safeOptions.repositoryLimit);
    if (repositories.length > targetRepositories.length) {
        stats.scope.isPartial = true;
    }
    for (const repo of targetRepositories) {
        if (stats.summary.commitsAnalyzed >= safeOptions.commitLimit) {
            stats.scope.isPartial = true;
            break;
        }
        try {
            let repoCommitCount = 0;
            let page = 1;
            let commits = [];
            while (stats.summary.commitsAnalyzed + commits.length < safeOptions.commitLimit) {
                const pageCommits = await githubRest(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits`, {
                    author: login,
                    since: since.toISOString(),
                    per_page: 100,
                    page,
                });
                commits = commits.concat(pageCommits);
                if (pageCommits.length < 100) {
                    break;
                }
                page += 1;
            }
            const remaining = safeOptions.commitLimit - stats.summary.commitsAnalyzed;
            commits = commits.slice(0, remaining);
            for (const commit of commits) {
                try {
                    const detail = await githubRest(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits/${commit.sha}`);
                    stats.summary.commitsAnalyzed += 1;
                    repoCommitCount += 1;
                    for (const file of detail.files ?? []) {
                        if (shouldExcludeFromCodeVolume(file.filename)) {
                            continue;
                        }
                        const language = languageForFilename(file.filename);
                        const entry = languageMap.get(language) ??
                            {
                                language,
                                filesChanged: 0,
                                additions: 0,
                                deletions: 0,
                                changes: 0,
                            };
                        entry.filesChanged += 1;
                        entry.additions += file.additions;
                        entry.deletions += file.deletions;
                        entry.changes += file.changes;
                        languageMap.set(language, entry);
                        stats.summary.filesChanged += 1;
                        stats.summary.additions += file.additions;
                        stats.summary.deletions += file.deletions;
                        stats.summary.changes += file.changes;
                    }
                }
                catch (error) {
                    stats.scope.isPartial = true;
                    stats.skippedRepositories.push({
                        nameWithOwner: repo.nameWithOwner,
                        reason: classifyRestError(error) === 'rate_limited'
                            ? 'rate_limited'
                            : 'commit_detail_failed',
                    });
                    break;
                }
            }
            if (repoCommitCount > 0) {
                stats.summary.repositoriesAnalyzed += 1;
                stats.commitCountsByRepository[repo.nameWithOwner] = repoCommitCount;
            }
        }
        catch (error) {
            stats.scope.isPartial = true;
            const reason = classifyRestError(error);
            stats.skippedRepositories.push({
                nameWithOwner: repo.nameWithOwner,
                reason: reason === 'unknown' ? 'commit_fetch_failed' : reason,
            });
        }
    }
    stats.byLanguage = [...languageMap.values()].sort((a, b) => b.changes - a.changes);
    return stats;
}
