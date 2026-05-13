import React from 'react';
import { GitHubStats } from '../api.js';

interface StatsCardProps {
  stats: GitHubStats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const formatNumber = (n: number): string => n.toLocaleString('en-US');

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.contributions)}</div>
        <div className="stat-label">Contributions</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.commits)}</div>
        <div className="stat-label">Commits</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.pullRequests)}</div>
        <div className="stat-label">Pull Requests</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.issues)}</div>
        <div className="stat-label">Issues</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.pullRequestReviews)}</div>
        <div className="stat-label">Reviews</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{formatNumber(stats.totals.repositories)}</div>
        <div className="stat-label">Repositories</div>
      </div>
    </div>
  );
};
