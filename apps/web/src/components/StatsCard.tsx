import React from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { GitHubStats } from '../api.js';

interface StatsCardProps {
  stats: GitHubStats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const formatNumber = (n: number): string => n.toLocaleString('en-US');
  const radialItems = [
    { label: 'Commits', value: stats.totals.commits },
    { label: 'PR', value: stats.totals.pullRequests },
    { label: 'Issue', value: stats.totals.issues },
    { label: 'Review', value: stats.totals.pullRequestReviews },
  ];
  const maxValue = Math.max(...radialItems.map((item) => item.value), 1);

  return (
    <section className="stats-card">
      <div className="stats-summary">
        <div>
          <div className="stat-value">{formatNumber(stats.totals.contributions)}</div>
          <div className="stat-label">Contributions</div>
        </div>
        <div>
          <div className="stat-value">{formatNumber(stats.totals.repositories)}</div>
          <div className="stat-label">Repositories</div>
        </div>
      </div>
      <div className="radial-panel">
        <div className="radial-chart" role="img" aria-label="Commits, PR, Issue, Review radial graph">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radialItems} outerRadius="68%">
              <PolarGrid gridType="polygon" stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, maxValue]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="value"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.28}
                dot={{ r: 4, fill: 'var(--accent)' }}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(value) => formatNumber(Number(value))}
                contentStyle={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="radial-legend">
          {radialItems.map((item) => (
            <div className="radial-legend-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
