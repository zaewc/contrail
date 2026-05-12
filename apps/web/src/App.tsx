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
