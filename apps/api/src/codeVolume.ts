import {
  classifyRestError,
  githubRest,
  queryGitHubGraphQL,
} from './githubClient.js';
import { languageForFilename } from './language.js';
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
export const MAX_COMMIT_LIMIT = 1000;
export const DEFAULT_REPOSITORY_LIMIT = readPositiveIntegerEnv(
  'CODE_VOLUME_REPOSITORY_LIMIT',
  20
);
export const MAX_REPOSITORY_LIMIT = 100;
const COMMIT_DETAIL_CONCURRENCY = 8;
const COMMIT_LIST_CONCURRENCY = 8;

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

type CommitHistoryResponse = {
  repository: {
    defaultBranchRef: {
      target: {
        history: {
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

function emptyStats(options: CodeVolumeOptions): CodeVolumeStats {
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

async function fetchCommitShasByUserId(
  repo: ContributedRepository,
  authorId: string,
  since: string
): Promise<CommitListItem[]> {
  const query = `
    query RepositoryCommitHistory($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100, author: { id: $authorId }, since: $since) {
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
  })) as CommitHistoryResponse;

  return (
    data.repository?.defaultBranchRef?.target?.history.nodes.map((node) => ({
      sha: node.oid,
      additions: node.additions,
      deletions: node.deletions,
      changedFiles: node.changedFiles,
    })) ?? []
  );
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
  const stats = emptyStats(safeOptions);
  const languageMap = new Map<string, LanguageVolume>();
  const since = new Date();
  since.setFullYear(since.getFullYear() - safeOptions.years);

  const targetRepositories = repositories.slice(0, safeOptions.repositoryLimit);
  if (repositories.length > targetRepositories.length) {
    stats.scope.isPartial = true;
  }

  const candidates: CommitCandidate[] = [];

  for (
    let i = 0;
    i < targetRepositories.length;
    i += COMMIT_LIST_CONCURRENCY
  ) {
    const batch = targetRepositories.slice(i, i + COMMIT_LIST_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (repo) => ({
        repo,
        commits: authorId
          ? await fetchCommitShasByUserId(repo, authorId, since.toISOString())
          : await githubRest<CommitListItem[]>(
              `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits`,
              {
                author: login,
                since: since.toISOString(),
                per_page: 100,
                page: 1,
              }
            ),
      }))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { repo, commits } = result.value;
        if (commits.length === 100) {
          stats.scope.isPartial = true;
        }
        for (const commit of commits) {
          candidates.push({ repo, commit });
        }
        return;
      }

      stats.scope.isPartial = true;
      const reason = classifyRestError(result.reason);
      const repo = batch[index];
      stats.skippedRepositories.push({
        nameWithOwner: repo.nameWithOwner,
        reason: reason === 'unknown' ? 'commit_fetch_failed' : reason,
      });
    });
  }

  const commitsToAnalyze =
    safeOptions.commitLimit === null
      ? candidates
      : candidates.slice(0, safeOptions.commitLimit);
  if (commitsToAnalyze.length < candidates.length) {
    stats.scope.isPartial = true;
  }

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
  }

  for (
    let i = 0;
    !authorId && i < commitsToAnalyze.length;
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
