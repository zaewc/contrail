import React, { useState } from 'react';
import { fetchStats, getCardUrl, GitHubStats } from './api.js';
import { StatsCard } from './components/StatsCard.js';
import { ContributionGrid } from './components/ContributionGrid.js';
import './styles.css';

type AppState = 'empty' | 'loading' | 'success' | 'error';

export const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [state, setState] = useState<AppState>('empty');
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!input.trim()) {
      setError('Please enter a GitHub username');
      setState('error');
      return;
    }

    setState('loading');
    setError('');
    setStats(null);

    try {
      const result = await fetchStats(input.trim());
      setStats(result);
      setState('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setState('error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const copyToClipboard = () => {
    if (!stats) return;
    const embedCode = `![contrail](${getCardUrl(stats.login)})`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  const formatNumber = (n: number): string => n.toLocaleString('en-US');
  const formatBytes = (bytes: number): string =>
    Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(bytes);
  const formatPercent = (n: number): string => `${n.toFixed(1)}%`;

  return (
    <div className="container">
      <div className="header">
        <h1 className="header-title">contrail</h1>
      </div>

      <div className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Enter GitHub username..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={state === 'loading'}
        />
        <button
          className="search-button"
          onClick={handleSearch}
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {state === 'loading' && <div className="loading">Loading your stats</div>}

      {state === 'error' && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {state === 'success' && stats && (
        <div className="results">
          <div className="profile">
            <div className="profile-avatar">
              {stats.name ? stats.name[0]?.toUpperCase() : '?'}
            </div>
            <div className="profile-info">
              <h2>{stats.name || stats.login}</h2>
              <div className="login">@{stats.login}</div>
              <div className="range">
                {formatDate(stats.range.from)} • {formatDate(stats.range.to)}
              </div>
            </div>
          </div>

          <StatsCard stats={stats} />

          <div className="analysis-grid">
            <section className="analysis-card">
              <h3>Streak</h3>
              <div className="metric-row">
                <span>Current streak</span>
                <strong>{formatNumber(stats.streaks.current)} days</strong>
              </div>
              <div className="metric-row">
                <span>Max streak</span>
                <strong>{formatNumber(stats.streaks.max)} days</strong>
              </div>
              <div className="metric-note">
                {stats.streaks.maxStartDate && stats.streaks.maxEndDate
                  ? `${stats.streaks.maxStartDate} → ${stats.streaks.maxEndDate}`
                  : 'No active streak in this range'}
              </div>
            </section>

            <section className="analysis-card">
              <h3>작성 커밋 기준 코드 변경량</h3>
              <div className="scope-note">
                최근 {stats.codeVolume.scope.years}년, 최대{' '}
                {formatNumber(stats.codeVolume.scope.commitLimit)}개 커밋 기준
              </div>
              <div className="metric-grid">
                <div>
                  <span>Lines added</span>
                  <strong>{formatNumber(stats.codeVolume.summary.additions)}</strong>
                </div>
                <div>
                  <span>Lines deleted</span>
                  <strong>{formatNumber(stats.codeVolume.summary.deletions)}</strong>
                </div>
                <div>
                  <span>Total changes</span>
                  <strong>{formatNumber(stats.codeVolume.summary.changes)}</strong>
                </div>
                <div>
                  <span>Files changed</span>
                  <strong>{formatNumber(stats.codeVolume.summary.filesChanged)}</strong>
                </div>
                <div>
                  <span>Commits analyzed</span>
                  <strong>{formatNumber(stats.codeVolume.summary.commitsAnalyzed)}</strong>
                </div>
                <div>
                  <span>Repositories analyzed</span>
                  <strong>{formatNumber(stats.codeVolume.summary.repositoriesAnalyzed)}</strong>
                </div>
              </div>
              {stats.codeVolume.scope.isPartial && (
                <div className="partial-note">
                  Some repositories may be partial due to GitHub API limits.
                </div>
              )}
            </section>
          </div>

          <section className="analysis-card full-width">
            <h3>기여 레포 기준 기술스택</h3>
            <div className="bar-list">
              {stats.techStack.slice(0, 8).map((item) => (
                <div className="bar-row" key={item.name}>
                  <div className="bar-label">
                    <strong>{item.name}</strong>
                    <span>
                      {formatPercent(item.percentage)} · {formatBytes(item.bytes)} ·{' '}
                      {formatNumber(item.repositories)} repos
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill tech"
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
              {stats.techStack.length === 0 && (
                <div className="metric-note">No language data available.</div>
              )}
            </div>
          </section>

          <section className="analysis-card full-width">
            <h3>Contribution type ratio</h3>
            <div className="ratio-list">
              {stats.contributionTypeRatios.map((ratio) => (
                <div className="ratio-row" key={ratio.scope}>
                  <div className="ratio-title">
                    <strong>
                      {ratio.scope === 'personal' ? 'Personal' : 'Organization'}
                    </strong>
                    <span>{formatNumber(ratio.totals.total)} contributions</span>
                  </div>
                  <div className="stacked-bar">
                    <div
                      className="stack commits"
                      style={{ width: `${ratio.ratios.commits}%` }}
                    />
                    <div
                      className="stack prs"
                      style={{ width: `${ratio.ratios.pullRequests}%` }}
                    />
                    <div
                      className="stack issues"
                      style={{ width: `${ratio.ratios.issues}%` }}
                    />
                    <div
                      className="stack reviews"
                      style={{ width: `${ratio.ratios.pullRequestReviews}%` }}
                    />
                  </div>
                  <div className="ratio-legend">
                    <span>commits {formatPercent(ratio.ratios.commits)}</span>
                    <span>PRs {formatPercent(ratio.ratios.pullRequests)}</span>
                    <span>Issues {formatPercent(ratio.ratios.issues)}</span>
                    <span>Reviews {formatPercent(ratio.ratios.pullRequestReviews)}</span>
                  </div>
                </div>
              ))}
            </div>
            {stats.contributionTypeRatios.some((ratio) => ratio.isPartial) && (
              <div className="partial-note">
                Some values may be partial due to GitHub API limitations.
              </div>
            )}
          </section>

          <div className="contribution-section">
            <h3>잔디</h3>
            <ContributionGrid days={stats.calendar} />
          </div>

          <div className="embed-section">
            <h3>리드미에 넣기</h3>
            <div className="embed-code">
              <code>![contrail]({getCardUrl(stats.login)})</code>
              <button
                className="copy-button"
                onClick={copyToClipboard}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {state === 'empty' && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">
            Enter a GitHub username to get started
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            No data is stored on our servers. All analysis happens instantly.
          </div>
        </div>
      )}
    </div>
  );
};
