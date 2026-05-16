import { z } from 'zod';
import {
  ContributedRepository,
  GitHubRepositoryNode,
  GitHubStats,
  GitHubUserData,
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

async function getUserDataForYear(
  login: string,
  fromDate: string,
  toDate: string
): Promise<GitHubUserData> {
  const query = `
    query UserContributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        id
        login
        name
        avatarUrl
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
        repositories(
          first: 100
          ownerAffiliations: OWNER
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes {
            ${repositoryFields()}
          }
        }
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

  const data = await queryGitHubGraphQL(query, {
    login,
    from: fromDate,
    to: toDate,
  });

  // Flatten weeks into calendar array
  const calendar: ContributionDay[] = [];
  for (const week of data.user.contributionsCollection.contributionCalendar
    .weeks) {
    for (const day of week.contributionDays) {
      calendar.push({
        date: day.date,
        count: day.contributionCount,
        color: day.color,
      });
    }
  }

  return {
    id: data.user.id,
    login: data.user.login,
    name: data.user.name,
    avatarUrl: data.user.avatarUrl,
    contributionsCollection: {
      contributionCalendar: {
        totalContributions:
          data.user.contributionsCollection.contributionCalendar
            .totalContributions,
        weeks: [
          {
            contributionDays: calendar,
          },
        ],
      },
      totalCommitContributions:
        data.user.contributionsCollection.totalCommitContributions,
      totalPullRequestContributions:
        data.user.contributionsCollection.totalPullRequestContributions,
      totalIssueContributions:
        data.user.contributionsCollection.totalIssueContributions,
      totalPullRequestReviewContributions:
        data.user.contributionsCollection.totalPullRequestReviewContributions,
      restrictedContributionsCount:
        data.user.contributionsCollection.restrictedContributionsCount,
    },
    repositoriesContributedTo:
      data.user.repositoriesContributedTo,
    repositories: data.user.repositories,
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

  const allYearData: GitHubUserData[] = [];
  const allCalendars: ContributionDay[][] = [];

  const cachedUserData = getCached<GitHubUserData[]>(userDataCacheKey(login));
  if (cachedUserData) {
    allYearData.push(...cachedUserData);
    for (const yearData of cachedUserData) {
      allCalendars.push(
        yearData.contributionsCollection.contributionCalendar.weeks.flatMap(
          (w) => w.contributionDays
        )
      );
    }
  } else {
    const yearResults = await Promise.allSettled(
      ranges.map((range) =>
        getUserDataForYear(
          login,
          range.from.toISOString(),
          range.to.toISOString()
        )
      )
    );

    for (const result of yearResults) {
      if (result.status === 'fulfilled') {
        const yearData = result.value;
        allYearData.push(yearData);
        allCalendars.push(
          yearData.contributionsCollection.contributionCalendar.weeks.flatMap(
            (w) => w.contributionDays
          )
        );
        continue;
      }

      const error = result.reason;
      if (error instanceof Error) {
        if (error.message === 'USER_NOT_FOUND') {
          throw error;
        }
        // Skip year on partial failure
        console.error(`Failed to fetch data for year: ${error.message}`);
      } else {
        console.error('Failed to fetch data for year');
      }
    }

    if (allYearData.length === 0) {
      throw new Error('USER_NOT_FOUND');
    }

    setCached(userDataCacheKey(login), allYearData, COMPONENT_CACHE_TTL);
  }

  // Use first year data for user info
  const firstYear = allYearData[0];

  // Merge calendars
  const mergedCalendar = mergeCalendars(allCalendars);

  // Merge totals
  let totalContributions = 0;
  let totalCommits = 0;
  let totalPullRequests = 0;
  let totalIssues = 0;
  let totalPullRequestReviews = 0;
  let totalRestricted = 0;
  const repositoryNodes: GitHubRepositoryNode[] = [];

  for (const yearData of allYearData) {
    totalContributions +=
      yearData.contributionsCollection.contributionCalendar.totalContributions;
    totalCommits +=
      yearData.contributionsCollection.totalCommitContributions;
    totalPullRequests +=
      yearData.contributionsCollection.totalPullRequestContributions;
    totalIssues +=
      yearData.contributionsCollection.totalIssueContributions;
    totalPullRequestReviews +=
      yearData.contributionsCollection.totalPullRequestReviewContributions;
    totalRestricted +=
      yearData.contributionsCollection.restrictedContributionsCount;
    repositoryNodes.push(
      ...yearData.repositories.nodes,
      ...yearData.repositoriesContributedTo.nodes
    );
  }

  // Repository count from last year (most recent)
  const repositoryCount =
    allYearData[allYearData.length - 1].repositoriesContributedTo.totalCount;

  const from = ranges[0].from;
  const to = ranges[ranges.length - 1].to;
  const repositories = normalizeRepositories(firstYear.login, repositoryNodes);
  const streaks = calculateStreaks(mergedCalendar);
  const commitLimit = options.commitLimit ?? DEFAULT_COMMIT_LIMIT;
  const cachedTechStack = getCached<TechStackItem[]>(
    techStackCacheKey(firstYear.login)
  );
  const techStackPromise: Promise<TechStackItem[]> = cachedTechStack
    ? Promise.resolve(cachedTechStack)
    : analyzeTechStack(repositories).then((result) => {
        setCached(
          techStackCacheKey(firstYear.login),
          result,
          COMPONENT_CACHE_TTL
        );
        return result;
      });
  const [codeVolume, techStack] = await Promise.all([
    analyzeCodeVolume(firstYear.login, repositories, {
      years: DEFAULT_CODE_VOLUME_YEARS,
      commitLimit,
      repositoryLimit:
        commitLimit === null || commitLimit > 100
          ? 100
          : DEFAULT_REPOSITORY_LIMIT,
    }, firstYear.id),
    techStackPromise,
  ]);
  const contributionTypeRatios =
    process.env.ANALYZE_CONTRIBUTION_RATIOS === 'true'
      ? await analyzeContributionTypeRatios(
          firstYear.login,
          repositories,
          codeVolume
        )
      : [];

  return {
    login: firstYear.login,
    name: firstYear.name,
    avatarUrl: firstYear.avatarUrl,
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
