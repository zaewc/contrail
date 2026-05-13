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

const API_BASE = '/api';

export async function fetchStats(login: string): Promise<GitHubStats> {
  const response = await fetch(`${API_BASE}/users/${login}/stats`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found');
    }
    if (response.status === 400) {
      throw new Error('Invalid login');
    }
    if (response.status === 502) {
      throw new Error('GitHub API error');
    }
    throw new Error('Failed to fetch stats');
  }

  return response.json();
}

export function getCardUrl(login: string): string {
  return `${API_BASE}/users/${login}/card.svg`;
}
