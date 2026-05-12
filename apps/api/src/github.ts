import { z } from 'zod';
import { GitHubStats, GitHubUserData, ContributionDay } from './types.js';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const loginSchema = z.string().min(1).max(39);

async function queryGitHubGraphQL(
  query: string,
  variables: Record<string, any>
): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json() as any;

  if (data.errors) {
    const errorMessage = (data.errors[0]?.message as string) || 'Unknown error';
    if (errorMessage.includes('Could not resolve to a User')) {
      throw new Error('USER_NOT_FOUND');
    }
    if (
      errorMessage.includes('Bad credentials') ||
      errorMessage.includes('API rate limit')
    ) {
      throw new Error('GITHUB_API_ERROR');
    }
    throw new Error(errorMessage);
  }

  return data.data as any;
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

async function getUserDataForYear(
  login: string,
  fromDate: string,
  toDate: string
): Promise<GitHubUserData> {
  const query = `
    query UserContributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
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
          restrictedContributionsCount
        }
        repositoriesContributedTo(
          first: 1
          contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
          includeUserRepositories: true
        ) {
          totalCount
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
      restrictedContributionsCount:
        data.user.contributionsCollection.restrictedContributionsCount,
    },
    repositoriesContributedTo:
      data.user.repositoriesContributedTo,
  };
}

export async function getGitHubStats(login: string): Promise<GitHubStats> {
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

  // Fetch data for each year
  const allYearData: GitHubUserData[] = [];
  const allCalendars: ContributionDay[][] = [];

  for (const range of ranges) {
    try {
      const yearData = await getUserDataForYear(
        login,
        range.from.toISOString(),
        range.to.toISOString()
      );
      allYearData.push(yearData);
      allCalendars.push(
        yearData.contributionsCollection.contributionCalendar.weeks.flatMap(
          (w) => w.contributionDays
        )
      );
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        throw error;
      }
      // Skip year on partial failure
      console.error(`Failed to fetch data for year: ${error.message}`);
    }
  }

  if (allYearData.length === 0) {
    throw new Error('USER_NOT_FOUND');
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
  let totalRestricted = 0;

  for (const yearData of allYearData) {
    totalContributions +=
      yearData.contributionsCollection.contributionCalendar.totalContributions;
    totalCommits +=
      yearData.contributionsCollection.totalCommitContributions;
    totalPullRequests +=
      yearData.contributionsCollection.totalPullRequestContributions;
    totalIssues +=
      yearData.contributionsCollection.totalIssueContributions;
    totalRestricted +=
      yearData.contributionsCollection.restrictedContributionsCount;
  }

  // Repository count from last year (most recent)
  const repositoryCount =
    allYearData[allYearData.length - 1].repositoriesContributedTo.totalCount;

  const from = ranges[0].from;
  const to = ranges[ranges.length - 1].to;

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
      repositories: repositoryCount,
      restrictedContributions: totalRestricted,
    },
    calendar: mergedCalendar,
  };
}
