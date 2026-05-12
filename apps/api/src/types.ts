export interface ContributionDay {
  date: string;
  count: number;
  color: string;
}

export interface DateRange {
  from: string;
  to: string;
  years: number;
}

export interface Totals {
  contributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  repositories: number;
  restrictedContributions: number;
}

export interface GitHubStats {
  login: string;
  name: string | null;
  avatarUrl: string;
  range: DateRange;
  totals: Totals;
  calendar: ContributionDay[];
}

export interface GitHubUserData {
  login: string;
  name: string | null;
  avatarUrl: string;
  contributionsCollection: {
    contributionCalendar: {
      totalContributions: number;
      weeks: Array<{
        contributionDays: ContributionDay[];
      }>;
    };
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
  };
  repositoriesContributedTo: {
    totalCount: number;
  };
}
