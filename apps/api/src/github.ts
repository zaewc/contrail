import { z } from 'zod';
import {
  ContributedRepository,
  GitHubRepositoryNode,
  GitHubStats,
  ContributionDay,
  TechStackItem,
} from './types.js';
import { queryGitHubGraphQL } from './githubClient.js';
import { calculateStreaks } from './streaks.js';
import {
  analyzeCodeVolume,
  DEFAULT_CODE_VOLUME_YEARS,
  DEFAULT_COMMIT_LIMIT,
  DEFAULT_REPOSITORY_LIMIT,
} from './codeVolume.js';
import { analyzeTechStack } from './techStack.js';
import { analyzeContributionTypeRatios } from './contributionRatios.js';
import { getCached, setCached } from './cache.js';

const loginSchema = z.string().min(1).max(39);
const COMPONENT_CACHE_TTL = parseInt(
  process.env.CACHE_TTL_SECONDS || '21600',
  10
);
const userDataCacheKey = (login: string) =>
  `github:user-data:${login.toLowerCase()}:v1`;
const techStackCacheKey = (login: string) =>
  `github:techstack:${login.toLowerCase()}:v1`;

interface GitHubStatsOptions {
  commitLimit?: number | null;
}

function mergeCalendars(calendars: ContributionDay[][]): ContributionDay[] {
  const dateMap = new Map<string, ContributionDay>();

  for (const calendar of calendars) {
    for (const day of calendar) {
      const existing = dateMap.get(day.date);
      if (existing) {
        existing.count += day.count;
      } else {
        dateMap.set(day.date, { ...day });
      }
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function repositoryFields() {
  return `
    nameWithOwner
    name
    url
    isPrivate
    isFork
    isArchived
    primaryLanguage {
      name
    }
    stargazerCount
    forkCount
    owner {
      login
      __typename
    }
  `;
}

function normalizeRepositories(
  login: string,
  nodes: GitHubRepositoryNode[]
): ContributedRepository[] {
  const seen = new Map<string, ContributedRepository>();
  const lowerLogin = login.toLowerCase();

  for (const node of nodes) {
    if (!node) {
      continue;
    }

    const owner = node.owner.login;
    const isPersonal = owner.toLowerCase() === lowerLogin;

    seen.set(node.nameWithOwner, {
      nameWithOwner: node.nameWithOwner,
      owner,
      name: node.name,
      url: node.url,
      isPrivate: node.isPrivate,
      isFork: node.isFork,
      isArchived: node.isArchived,
      isPersonal,
      isOrganization: !isPersonal,
      primaryLanguage: node.primaryLanguage?.name ?? null,
      stargazerCount: node.stargazerCount,
      forkCount: node.forkCount,
    });
  }

  return [...seen.values()].sort((a, b) =>
    a.nameWithOwner.localeCompare(b.nameWithOwner)
  );
}

interface ProfileAndRepositories {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  repositoryNodes: GitHubRepositoryNode[];
  repositoryCount: number;
}

interface YearContributions {
  calendar: ContributionDay[];
  totalContributions: number;
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalPullRequestReviewContributions: number;
  restrictedContributionsCount: number;
}

interface CachedUserData {
  profile: ProfileAndRepositories;
  years: YearContributions[];
}

// The repository lists are not date-filtered, so they are identical for every
// year in the range. Fetch them once (instead of repeating them inside all five
// per-year contribution queries) to roughly halve the cold user-data latency and
// the GitHub API load.
async function getRepositoriesAndProfile(
  login: string
): Promise<ProfileAndRepositories> {
  // Fetching both repository connections in one query serializes their (slow,
  // server-side) computation for prolific users. Split them into two queries
  // that run concurrently; only the owned-repositories query carries identity
  // and must succeed.
  const ownedQuery = `
    query UserOwnedRepositories($login: String!) {
      user(login: $login) {
        id
        login
        name
        avatarUrl
        repositories(
          first: 100
          ownerAffiliations: OWNER
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes {
            ${repositoryFields()}
          }
        }
      }
    }
  `;
  const contributedQuery = `
    query UserContributedRepositories($login: String!) {
      user(login: $login) {
        repositoriesContributedTo(
          first: 100
          contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW, REPOSITORY]
          includeUserRepositories: true
        ) {
          totalCount
          nodes {
            ${repositoryFields()}
          }
        }
      }
    }
  `;

  const [ownedResult, contributedResult] = await Promise.allSettled([
    queryGitHubGraphQL(ownedQuery, { login }),
    queryGitHubGraphQL(contributedQuery, { login }),
  ]);

  if (ownedResult.status !== 'fulfilled') {
    throw ownedResult.reason instanceof Error
      ? ownedResult.reason
      : new Error('USER_NOT_FOUND');
  }
  const owned = ownedResult.value;
  const contributed =
    contributedResult.status === 'fulfilled'
      ? contributedResult.value.user.repositoriesContributedTo
      : { totalCount: 0, nodes: [] as GitHubRepositoryNode[] };

  return {
    id: owned.user.id,
    login: owned.user.login,
    name: owned.user.name,
    avatarUrl: owned.user.avatarUrl,
    repositoryNodes: [...owned.user.repositories.nodes, ...contributed.nodes],
    repositoryCount: contributed.totalCount,
  };
}

async function getContributionsForYear(
  login: string,
  fromDate: string,
  toDate: string
): Promise<YearContributions> {
  const query = `
    query UserContributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          restrictedContributionsCount
        }
      }
    }
  `;

  const data = await queryGitHubGraphQL(query, {
    login,
    from: fromDate,
    to: toDate,
  });

  const collection = data.user.contributionsCollection;
  const calendar: ContributionDay[] = [];
  for (const week of collection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      calendar.push({
        date: day.date,
        count: day.contributionCount,
        color: day.color,
      });
    }
  }

  return {
    calendar,
    totalContributions: collection.contributionCalendar.totalContributions,
    totalCommitContributions: collection.totalCommitContributions,
    totalPullRequestContributions: collection.totalPullRequestContributions,
    totalIssueContributions: collection.totalIssueContributions,
    totalPullRequestReviewContributions:
      collection.totalPullRequestReviewContributions,
    restrictedContributionsCount: collection.restrictedContributionsCount,
  };
}

export async function getGitHubStats(
  login: string,
  options: GitHubStatsOptions = {}
): Promise<GitHubStats> {
  // Validate login
  try {
    loginSchema.parse(login);
  } catch (e) {
    throw new Error('INVALID_LOGIN');
  }

  // Calculate date ranges (last 5 years)
  const now = new Date();
  const ranges: Array<{ from: Date; to: Date }> = [];

  for (let i = 0; i < 5; i++) {
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - (i + 1));

    const to = new Date(now);
    to.setFullYear(to.getFullYear() - i);

    ranges.push({ from, to });
  }

  ranges.reverse();

  let profile: ProfileAndRepositories;
  let years: YearContributions[];

  const cachedUserData = getCached<CachedUserData>(userDataCacheKey(login));
  if (cachedUserData) {
    profile = cachedUserData.profile;
    years = cachedUserData.years;
  } else {
    // Start the repository/profile query and all per-year contribution queries
    // concurrently; only the profile query is required to succeed.
    const profilePromise = getRepositoriesAndProfile(login);
    const yearResultsPromise = Promise.allSettled(
      ranges.map((range) =>
        getContributionsForYear(
          login,
          range.from.toISOString(),
          range.to.toISOString()
        )
      )
    );

    try {
      profile = await profilePromise;
    } catch (error) {
      throw error instanceof Error ? error : new Error('USER_NOT_FOUND');
    }

    const yearResults = await yearResultsPromise;
    years = [];
    for (const result of yearResults) {
      if (result.status === 'fulfilled') {
        years.push(result.value);
        continue;
      }

      const error = result.reason;
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        throw error;
      }
      // Skip year on partial failure
      console.error(
        `Failed to fetch contributions for year: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    setCached(userDataCacheKey(login), { profile, years }, COMPONENT_CACHE_TTL);
  }

  // Merge calendars
  const mergedCalendar = mergeCalendars(years.map((year) => year.calendar));

  // Merge totals
  let totalContributions = 0;
  let totalCommits = 0;
  let totalPullRequests = 0;
  let totalIssues = 0;
  let totalPullRequestReviews = 0;
  let totalRestricted = 0;

  for (const year of years) {
    totalContributions += year.totalContributions;
    totalCommits += year.totalCommitContributions;
    totalPullRequests += year.totalPullRequestContributions;
    totalIssues += year.totalIssueContributions;
    totalPullRequestReviews += year.totalPullRequestReviewContributions;
    totalRestricted += year.restrictedContributionsCount;
  }

  const repositoryCount = profile.repositoryCount;

  const from = ranges[0].from;
  const to = ranges[ranges.length - 1].to;
  const repositories = normalizeRepositories(
    profile.login,
    profile.repositoryNodes
  );
  const streaks = calculateStreaks(mergedCalendar);
  const commitLimit = options.commitLimit ?? DEFAULT_COMMIT_LIMIT;
  const cachedTechStack = getCached<TechStackItem[]>(
    techStackCacheKey(profile.login)
  );
  const techStackPromise: Promise<TechStackItem[]> = cachedTechStack
    ? Promise.resolve(cachedTechStack)
    : analyzeTechStack(repositories).then((result) => {
        setCached(
          techStackCacheKey(profile.login),
          result,
          COMPONENT_CACHE_TTL
        );
        return result;
      });
  const [codeVolume, techStack] = await Promise.all([
    analyzeCodeVolume(profile.login, repositories, {
      years: DEFAULT_CODE_VOLUME_YEARS,
      commitLimit,
      repositoryLimit:
        commitLimit === null || commitLimit > 100
          ? 100
          : DEFAULT_REPOSITORY_LIMIT,
    }, profile.id),
    techStackPromise,
  ]);
  const contributionTypeRatios =
    process.env.ANALYZE_CONTRIBUTION_RATIOS === 'true'
      ? await analyzeContributionTypeRatios(
          profile.login,
          repositories,
          codeVolume
        )
      : [];

  return {
    login: profile.login,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      years: 5,
    },
    totals: {
      contributions: totalContributions,
      commits: totalCommits,
      pullRequests: totalPullRequests,
      issues: totalIssues,
      pullRequestReviews: totalPullRequestReviews,
      repositories: Math.max(repositoryCount, repositories.length),
      restrictedContributions: totalRestricted,
    },
    calendar: mergedCalendar,
    streaks,
    repositories,
    techStack,
    codeVolume,
    contributionTypeRatios,
  };
}
