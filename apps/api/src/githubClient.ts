const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';

export const MIN_RATE_LIMIT_REMAINING = Number(
  process.env.GITHUB_REST_MIN_RATE_LIMIT_REMAINING ?? 5
);

export type GitHubRestErrorReason =
  | 'not_found'
  | 'forbidden'
  | 'rate_limited'
  | 'unknown';

export class GitHubRestError extends Error {
  reason: GitHubRestErrorReason;

  constructor(reason: GitHubRestErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  return token;
}

export async function queryGitHubGraphQL(
  query: string,
  variables: Record<string, any>
): Promise<any> {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as any;

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

export function classifyRestError(error: unknown): GitHubRestErrorReason {
  if (error instanceof GitHubRestError) {
    return error.reason;
  }
  return 'unknown';
}

export async function githubRest<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${GITHUB_REST_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const remaining =
    remainingHeader === null ? Number.NaN : Number(remainingHeader);
  if (!Number.isNaN(remaining) && remaining < MIN_RATE_LIMIT_REMAINING) {
    throw new GitHubRestError('rate_limited', 'GitHub REST rate limit is low');
  }

  if (response.status === 404) {
    throw new GitHubRestError('not_found', 'GitHub resource not found');
  }
  if (response.status === 403) {
    const reason =
      response.headers.get('x-ratelimit-remaining') === '0'
        ? 'rate_limited'
        : 'forbidden';
    throw new GitHubRestError(reason, `GitHub REST forbidden: ${reason}`);
  }
  if (!response.ok) {
    throw new GitHubRestError('unknown', `GitHub REST error: ${response.status}`);
  }

  return (await response.json()) as T;
}
