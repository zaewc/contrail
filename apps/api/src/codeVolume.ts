import {
  classifyRestError,
  githubRest,
  queryGitHubGraphQL,
} from './githubClient.js';
import { languageForFilename } from './language.js';
import { getCached, setCached } from './cache.js';
import {
  CodeVolumeOptions,
  CodeVolumeStats,
  ContributedRepository,
} from './types.js';

export const DEFAULT_CODE_VOLUME_YEARS = 5;
function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const DEFAULT_COMMIT_LIMIT = readPositiveIntegerEnv(
  'CODE_VOLUME_COMMIT_LIMIT',
  100
);
export const MAX_COMMIT_LIMIT = 10000;
export const DEFAULT_REPOSITORY_LIMIT = readPositiveIntegerEnv(
  'CODE_VOLUME_REPOSITORY_LIMIT',
  20
);
export const MAX_REPOSITORY_LIMIT = 100;
const COMMIT_DETAIL_CONCURRENCY = 8;
const COMMIT_LIST_CONCURRENCY = 8;
const CANDIDATE_CACHE_TTL = parseInt(
  process.env.CACHE_TTL_SECONDS || '21600',
  10
);

type CommitListItem = {
  sha: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
};

type CommitCandidate = {
  repo: ContributedRepository;
  commit: CommitListItem;
};

type CommitHistoryState = {
  repo: ContributedRepository;
  cursor: string | null;
};

type CommitHistoryResponse = {
  repository: {
    defaultBranchRef: {
      target: {
        history: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          nodes: Array<{
            oid: string;
            additions: number;
            deletions: number;
            changedFiles: number;
          }>;
        };
      } | null;
    } | null;
  } | null;
};

type CommitDetail = {
  files?: Array<{
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
};

type LanguageVolume = {
  language: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  changes: number;
};

type CandidateCacheEntry = {
  authorId: string | null;
  years: number;
  repositoryLimit: number;
  since: string;
  targetRepositoryNames: string[];
  initialPartialFromRepoLimit: boolean;
  candidates: CommitCandidate[];
  queue: CommitHistoryState[];
  skippedRepositories: Array<{ nameWithOwner: string; reason: string }>;
  exhausted: boolean;
};

const candidateCacheKey = (login: string) =>
  `github:candidates:${login.toLowerCase()}:v1`;

function isCacheCompatible(
  entry: CandidateCacheEntry,
  authorId: string | undefined,
  years: number,
  repositoryLimit: number,
  targetRepoNames: string[]
): boolean {
  if (entry.authorId !== (authorId ?? null)) return false;
  if (entry.years !== years) return false;
  if (entry.repositoryLimit !== repositoryLimit) return false;
  if (entry.targetRepositoryNames.length !== targetRepoNames.length) return false;
  for (let i = 0; i < targetRepoNames.length; i++) {
    if (entry.targetRepositoryNames[i] !== targetRepoNames[i]) return false;
  }
  return true;
}

function addCommitDetailToStats(
  detail: CommitDetail,
  stats: CodeVolumeStats,
  languageMap: Map<string, LanguageVolume>
): void {
  stats.summary.commitsAnalyzed += 1;

  for (const file of detail.files ?? []) {
    const language = languageForFilename(file.filename);
    const entry =
      languageMap.get(language) ??
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

function addCommitSummaryToStats(
  commit: CommitListItem,
  stats: CodeVolumeStats
): void {
  stats.summary.commitsAnalyzed += 1;
  stats.summary.filesChanged += commit.changedFiles ?? 0;
  stats.summary.additions += commit.additions ?? 0;
  stats.summary.deletions += commit.deletions ?? 0;
  stats.summary.changes += (commit.additions ?? 0) + (commit.deletions ?? 0);
}

async function fetchCommitShasByUserId(
  repo: ContributedRepository,
  authorId: string,
  since: string,
  after?: string | null
): Promise<{
  commits: CommitListItem[];
  hasNextPage: boolean;
  endCursor: string | null;
}> {
  const query = `
    query RepositoryCommitHistory($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $after: String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100, after: $after, author: { id: $authorId }, since: $since) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  oid
                  additions
                  deletions
                  changedFiles
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = (await queryGitHubGraphQL(query, {
    owner: repo.owner,
    name: repo.name,
    authorId,
    since,
    after,
  })) as CommitHistoryResponse;
  const history = data.repository?.defaultBranchRef?.target?.history;

  return {
    commits: history?.nodes.map((node) => ({
      sha: node.oid,
      additions: node.additions,
      deletions: node.deletions,
      changedFiles: node.changedFiles,
    })) ?? [],
    hasNextPage: history?.pageInfo.hasNextPage ?? false,
    endCursor: history?.pageInfo.endCursor ?? null,
  };
}

async function gatherWithAuthorId(
  entry: CandidateCacheEntry,
  authorId: string,
  targetCommitCount: number
): Promise<void> {
  while (entry.queue.length > 0 && entry.candidates.length < targetCommitCount) {
    const batch = entry.queue.splice(0, COMMIT_LIST_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (state) => ({
        state,
        page: await fetchCommitShasByUserId(
          state.repo,
          authorId,
          entry.since,
          state.cursor
        ),
      }))
    );

    results.forEach((result, index) => {
      const state = batch[index];
      if (result.status === 'fulfilled') {
        for (const commit of result.value.page.commits) {
          entry.candidates.push({ repo: state.repo, commit });
        }
        if (result.value.page.hasNextPage) {
          entry.queue.push({
            repo: state.repo,
            cursor: result.value.page.endCursor,
          });
        }
        return;
      }

      const reason = classifyRestError(result.reason);
      entry.skippedRepositories.push({
        nameWithOwner: state.repo.nameWithOwner,
        reason: reason === 'unknown' ? 'commit_fetch_failed' : reason,
      });
    });
  }

  if (entry.queue.length === 0) {
    entry.exhausted = true;
  }
}

async function gatherWithRestFallback(
  entry: CandidateCacheEntry,
  login: string,
  targetRepositories: ContributedRepository[]
): Promise<void> {
  if (entry.exhausted) {
    return;
  }

  for (let i = 0; i < targetRepositories.length; i += COMMIT_LIST_CONCURRENCY) {
    const batch = targetRepositories.slice(i, i + COMMIT_LIST_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (repo) => ({
        repo,
        commits: await githubRest<CommitListItem[]>(
          `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits`,
          {
            author: login,
            since: entry.since,
            per_page: 100,
            page: 1,
          }
        ),
      }))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { repo, commits } = result.value;
        for (const commit of commits) {
          entry.candidates.push({ repo, commit });
        }
        return;
      }

      const reason = classifyRestError(result.reason);
      const repo = batch[index];
      entry.skippedRepositories.push({
        nameWithOwner: repo.nameWithOwner,
        reason: reason === 'unknown' ? 'commit_fetch_failed' : reason,
      });
    });
  }

  entry.exhausted = true;
}

export async function analyzeCodeVolume(
  login: string,
  repositories: ContributedRepository[],
  options: CodeVolumeOptions,
  authorId?: string
): Promise<CodeVolumeStats> {
  const safeOptions = {
    years: Math.max(1, options.years),
    commitLimit:
      options.commitLimit === null
        ? null
        : Math.min(options.commitLimit, MAX_COMMIT_LIMIT),
    repositoryLimit: Math.min(options.repositoryLimit, MAX_REPOSITORY_LIMIT),
  };

  const targetRepositories = repositories.slice(0, safeOptions.repositoryLimit);
  const targetRepoNames = targetRepositories.map((r) => r.nameWithOwner);
  const initialPartialFromRepoLimit =
    repositories.length > targetRepositories.length;

  const cacheKey = candidateCacheKey(login);
  const cached = getCached<CandidateCacheEntry>(cacheKey);

  let entry: CandidateCacheEntry;
  if (
    cached &&
    isCacheCompatible(
      cached,
      authorId,
      safeOptions.years,
      safeOptions.repositoryLimit,
      targetRepoNames
    )
  ) {
    entry = cached;
  } else {
    const since = new Date();
    since.setFullYear(since.getFullYear() - safeOptions.years);
    entry = {
      authorId: authorId ?? null,
      years: safeOptions.years,
      repositoryLimit: safeOptions.repositoryLimit,
      since: since.toISOString(),
      targetRepositoryNames: targetRepoNames,
      initialPartialFromRepoLimit,
      candidates: [],
      queue: targetRepositories.map((repo) => ({ repo, cursor: null })),
      skippedRepositories: [],
      exhausted: false,
    };
  }

  const targetCommitCount =
    safeOptions.commitLimit ?? Number.POSITIVE_INFINITY;
  const needsMoreCandidates =
    !entry.exhausted && entry.candidates.length < targetCommitCount;

  if (needsMoreCandidates) {
    if (authorId) {
      await gatherWithAuthorId(entry, authorId, targetCommitCount);
    } else {
      await gatherWithRestFallback(entry, login, targetRepositories);
    }
    setCached(cacheKey, entry, CANDIDATE_CACHE_TTL);
  }

  const stats: CodeVolumeStats = {
    scope: {
      years: safeOptions.years,
      commitLimit: safeOptions.commitLimit,
      repositoryLimit: safeOptions.repositoryLimit,
      isPartial:
        entry.initialPartialFromRepoLimit ||
        entry.skippedRepositories.length > 0 ||
        !entry.exhausted,
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
    skippedRepositories: [...entry.skippedRepositories],
    commitCountsByRepository: {},
  };

  const commitsToAnalyze =
    safeOptions.commitLimit === null
      ? entry.candidates
      : entry.candidates.slice(0, safeOptions.commitLimit);
  if (commitsToAnalyze.length < entry.candidates.length) {
    stats.scope.isPartial = true;
  }

  const languageMap = new Map<string, LanguageVolume>();
  const commitCountsByRepository = new Map<string, number>();
  const detailFailureByRepository = new Map<string, string>();

  if (authorId) {
    for (const { repo, commit } of commitsToAnalyze) {
      addCommitSummaryToStats(commit, stats);
      commitCountsByRepository.set(
        repo.nameWithOwner,
        (commitCountsByRepository.get(repo.nameWithOwner) ?? 0) + 1
      );
    }
  } else {
    for (
      let i = 0;
      i < commitsToAnalyze.length;
      i += COMMIT_DETAIL_CONCURRENCY
    ) {
      const batch = commitsToAnalyze.slice(i, i + COMMIT_DETAIL_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(({ repo, commit }) =>
          githubRest<CommitDetail>(
            `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits/${commit.sha}`
          )
        )
      );

      results.forEach((result, index) => {
        const { repo } = batch[index];
        if (result.status === 'fulfilled') {
          addCommitDetailToStats(result.value, stats, languageMap);
          commitCountsByRepository.set(
            repo.nameWithOwner,
            (commitCountsByRepository.get(repo.nameWithOwner) ?? 0) + 1
          );
          return;
        }

        stats.scope.isPartial = true;
        detailFailureByRepository.set(
          repo.nameWithOwner,
          classifyRestError(result.reason) === 'rate_limited'
            ? 'rate_limited'
            : 'commit_detail_failed'
        );
      });
    }
  }

  for (const [nameWithOwner, count] of commitCountsByRepository) {
    stats.summary.repositoriesAnalyzed += 1;
    stats.commitCountsByRepository![nameWithOwner] = count;
  }

  for (const [nameWithOwner, reason] of detailFailureByRepository) {
    stats.skippedRepositories.push({ nameWithOwner, reason });
  }

  stats.byLanguage = [...languageMap.values()].sort(
    (a, b) => b.changes - a.changes
  );

  return stats;
}
