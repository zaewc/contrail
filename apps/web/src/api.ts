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
    commitLimit: number | null;
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

export async function fetchStats(
  login: string,
  commitLimit?: number
): Promise<GitHubStats> {
  const params = new URLSearchParams();
  if (commitLimit !== undefined) {
    params.set('commitLimit', String(commitLimit));
  }
  const query = params.toString();
  const response = await fetch(
    `${API_BASE}/users/${login}/stats${query ? `?${query}` : ''}`
  );

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

export async function fetchTechStack(login: string): Promise<TechStackItem[]> {
  const response = await fetch(`${API_BASE}/users/${login}/techstack`);

  if (!response.ok) {
    throw new Error('Failed to fetch tech stack');
  }

  const data = (await response.json()) as { techStack: TechStackItem[] };
  return data.techStack;
}

// The embed markdown is pasted into a GitHub README, where a relative path
// would resolve against github.com and fail to load. Build an absolute URL from
// the deployment origin (overridable via VITE_CARD_ORIGIN) so the card renders.
function getPublicOrigin(): string {
  const configured = import.meta.env.VITE_CARD_ORIGIN as string | undefined;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getCardUrl(login: string): string {
  return `${getPublicOrigin()}${API_BASE}/users/${login}/card.svg`;
}

export function getEmbedMarkdown(login: string): string {
  return `[![contrail](${getCardUrl(login)})](${getPublicOrigin()}/?user=${encodeURIComponent(
    login
  )})`;
}
