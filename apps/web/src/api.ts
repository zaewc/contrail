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
