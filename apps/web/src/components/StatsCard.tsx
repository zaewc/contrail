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
import { formatNumber } from '../utils/format.js';

interface StatsCardProps {
  stats: GitHubStats;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const radialItems = [
    { label: 'Commits', value: stats.totals.commits },
    { label: 'PR', value: stats.totals.pullRequests },
    { label: 'Issue', value: stats.totals.issues },
    { label: 'Review', value: stats.totals.pullRequestReviews },
  ];
  const maxValue = Math.max(...radialItems.map((item) => item.value), 1);

  return (
    <section className="stats-card">
      <div className="lede">
        <div className="lede-figure">
          <span className="lede-value">
            {formatNumber(stats.totals.contributions)}
          </span>
          <span className="lede-label">Contributions</span>
        </div>
        <div className="lede-figure">
          <span className="lede-value">
            {formatNumber(stats.totals.repositories)}
          </span>
          <span className="lede-label">Repositories</span>
        </div>
        <div className="lede-figure">
          <span className="lede-value">{formatNumber(stats.totals.stars)}</span>
          <span className="lede-label">Stars Received</span>
        </div>
      </div>
      <figure className="radial-panel">
        <figcaption className="feature-head">
          <span className="feature-no">01</span>
          <span className="feature-title">The Shape of the Work</span>
        </figcaption>
        <div
          className="radial-chart"
          role="img"
          aria-label="Commits, PR, Issue, Review radial graph"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radialItems} outerRadius="70%">
              <PolarGrid gridType="polygon" stroke="var(--rule)" />
              <PolarAngleAxis
                dataKey="label"
                tick={{
                  fill: 'var(--ink-soft)',
                  fontSize: 11,
                  fontFamily: 'Archivo, sans-serif',
                  letterSpacing: 1,
                }}
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
                fillOpacity={0.12}
                dot={{ r: 3, fill: 'var(--ink)' }}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(value) => formatNumber(Number(value))}
                contentStyle={{
                  backgroundColor: 'var(--ink)',
                  border: 'none',
                  borderRadius: 0,
                  color: 'var(--paper)',
                  fontFamily: 'Archivo, sans-serif',
                  fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="radial-legend">
          {radialItems.map((item) => (
            <div className="radial-legend-item" key={item.label}>
              <span className="radial-legend-label">{item.label}</span>
              <span className="radial-legend-value">
                {formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </figure>
    </section>
  );
};
