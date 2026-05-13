import { githubRest } from './githubClient.js';
import {
  CodeVolumeStats,
  ContributionTypeRatio,
  ContributedRepository,
} from './types.js';

type Scope = 'personal' | 'organization';

type SearchResponse = {
  total_count: number;
};

function emptyTotals() {
  return {
    commits: 0,
    pullRequests: 0,
    issues: 0,
    pullRequestReviews: 0,
    total: 0,
  };
}

function getScope(repo: ContributedRepository): Scope {
  return repo.isPersonal ? 'personal' : 'organization';
}

function finalizeRatio(
  scope: Scope,
  totals: ReturnType<typeof emptyTotals>,
  isPartial: boolean
): ContributionTypeRatio {
  totals.total =
    totals.commits +
    totals.pullRequests +
    totals.issues +
    totals.pullRequestReviews;

  const ratio = (count: number) =>
    totals.total === 0 ? 0 : (count / totals.total) * 100;

  return {
    scope,
    totals,
    ratios: {
      commits: ratio(totals.commits),
      pullRequests: ratio(totals.pullRequests),
      issues: ratio(totals.issues),
      pullRequestReviews: ratio(totals.pullRequestReviews),
    },
    isPartial,
    note: isPartial
      ? 'Some values may be partial due to GitHub API limitations. Pull request reviews are not included in this MVP analysis.'
      : 'Pull request reviews are not included in this MVP analysis.',
  };
}

async function countSearch(query: string): Promise<number> {
  const result = await githubRest<SearchResponse>('/search/issues', {
    q: query,
    per_page: 1,
  });
  return result.total_count;
}

export async function analyzeContributionTypeRatios(
  login: string,
  repositories: ContributedRepository[],
  codeVolume?: CodeVolumeStats
): Promise<ContributionTypeRatio[]> {
  const totals: Record<Scope, ReturnType<typeof emptyTotals>> = {
    personal: emptyTotals(),
    organization: emptyTotals(),
  };
  let isPartial = true;

  for (const repo of repositories) {
    const commits = codeVolume?.commitCountsByRepository?.[repo.nameWithOwner] ?? 0;
    totals[getScope(repo)].commits += commits;
  }

  try {
    const personalOwners = new Set(
      repositories.filter((repo) => repo.isPersonal).map((repo) => repo.owner)
    );
    const organizationOwners = new Set(
      repositories.filter((repo) => repo.isOrganization).map((repo) => repo.owner)
    );

    for (const owner of personalOwners) {
      totals.personal.pullRequests += await countSearch(
        `author:${login} type:pr user:${owner}`
      );
      totals.personal.issues += await countSearch(
        `author:${login} type:issue user:${owner}`
      );
    }

    for (const owner of organizationOwners) {
      totals.organization.pullRequests += await countSearch(
        `author:${login} type:pr user:${owner}`
      );
      totals.organization.issues += await countSearch(
        `author:${login} type:issue user:${owner}`
      );
    }
  } catch {
    isPartial = true;
  }

  return [
    finalizeRatio('personal', totals.personal, isPartial),
    finalizeRatio('organization', totals.organization, isPartial),
  ];
}
