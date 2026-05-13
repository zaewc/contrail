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
  pullRequestReviews: number;
  repositories: number;
  restrictedContributions: number;
}

export interface StreakStats {
  current: number;
  max: number;
  maxStartDate: string | null;
  maxEndDate: string | null;
}

export interface CodeVolumeOptions {
  years: number;
  commitLimit: number;
  repositoryLimit: number;
}

export interface CodeVolumeStats {
  scope: {
    years: number;
    commitLimit: number;
    repositoryLimit: number;
    isPartial: boolean;
  };
  summary: {
    commitsAnalyzed: number;
    repositoriesAnalyzed: number;
    filesChanged: number;
    additions: number;
    deletions: number;
    changes: number;
  };
  byLanguage: Array<{
    language: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    changes: number;
  }>;
  skippedRepositories: Array<{
    nameWithOwner: string;
    reason: string;
  }>;
  commitCountsByRepository?: Record<string, number>;
}

export interface TechStackItem {
  name: string;
  bytes: number;
  percentage: number;
  repositories: number;
}

export interface ContributionTypeRatio {
  scope: 'personal' | 'organization';
  totals: {
    commits: number;
    pullRequests: number;
    issues: number;
    pullRequestReviews: number;
    total: number;
  };
  ratios: {
    commits: number;
    pullRequests: number;
    issues: number;
    pullRequestReviews: number;
  };
  isPartial?: boolean;
  note?: string;
}

export interface ContributedRepository {
  nameWithOwner: string;
  owner: string;
  name: string;
  url: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  isPersonal: boolean;
  isOrganization: boolean;
  primaryLanguage: string | null;
  stargazerCount: number;
  forkCount: number;
}

export interface GitHubStats {
  login: string;
  name: string | null;
  avatarUrl: string;
  range: DateRange;
  totals: Totals;
  calendar: ContributionDay[];
  streaks: StreakStats;
  repositories: ContributedRepository[];
  techStack: TechStackItem[];
  codeVolume: CodeVolumeStats;
  contributionTypeRatios: ContributionTypeRatio[];
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
    totalPullRequestReviewContributions: number;
    restrictedContributionsCount: number;
  };
  repositoriesContributedTo: {
    totalCount: number;
    nodes: GitHubRepositoryNode[];
  };
  repositories: {
    nodes: GitHubRepositoryNode[];
  };
}

export interface GitHubRepositoryNode {
  nameWithOwner: string;
  name: string;
  url: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  primaryLanguage: {
    name: string;
  } | null;
  stargazerCount: number;
  forkCount: number;
  owner: {
    login: string;
    __typename?: string;
  };
}
