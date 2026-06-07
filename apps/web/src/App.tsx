import React, { useEffect, useRef, useState } from 'react';
import {
  fetchStats,
  fetchTechStack,
  getEmbedMarkdown,
  GitHubStats,
  TechStackItem,
} from './api.js';
import { StatsCard } from './components/StatsCard.js';
import { ContributionGrid } from './components/ContributionGrid.js';
import { TechTreemap } from './components/TechTreemap.js';
import { formatDate, formatNumber } from './utils/format.js';
import './styles.css';

type AppState = 'empty' | 'loading' | 'success' | 'error';
const INITIAL_COMMIT_LIMIT = 100;
const FINAL_COMMIT_LIMIT = 10000;
const INCREMENTAL_COMMIT_LIMITS = [
  300,
  700,
  1500,
  3000,
  5000,
  7500,
  10000,
];

export const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [state, setState] = useState<AppState>('empty');
  const [stats, setStats] = useState<GitHubStats | null>(null);
  // Tech stack loads separately from the main stats so the slow per-repo
  // language scan doesn't block the rest of the dashboard. null = still loading.
  const [techStack, setTechStack] = useState<TechStackItem[] | null>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const activeRequestRef = useRef(0);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    [],
  );

  const handleSearch = async (overrideLogin?: string) => {
    const login = (overrideLogin ?? input).trim();
    if (!login) {
      setError('Please enter a GitHub username');
      setState('error');
      return;
    }
    if (overrideLogin !== undefined && overrideLogin !== input) {
      setInput(login);
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setState('loading');
    setError('');
    setStats(null);
    setTechStack(null);

    try {
      const result = await fetchStats(login, INITIAL_COMMIT_LIMIT);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setStats(result);
      setState('success');
      void loadTechStack(login, requestId);
      if (result.codeVolume.scope.isPartial) {
        void refreshStatsIncrementally(login, requestId, result);
      }
    } catch (err) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setState('error');
    }
  };

  // Auto-load the user from a ?user= query param so the card embedded in a
  // README can deep-link back into the live dashboard.
  useEffect(() => {
    const user = new URLSearchParams(window.location.search).get('user');
    if (user && user.trim()) {
      void handleSearch(user.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStatsIncrementally = async (
    login: string,
    requestId: number,
    initialStats: GitHubStats
  ) => {
    let previousAnalyzed = initialStats.codeVolume.summary.commitsAnalyzed;

    for (const commitLimit of INCREMENTAL_COMMIT_LIMITS) {
      try {
        const nextStats = await fetchStats(login, commitLimit);
        if (activeRequestRef.current !== requestId) {
          return;
        }

        const nextAnalyzed = nextStats.codeVolume.summary.commitsAnalyzed;
        if (nextAnalyzed <= previousAnalyzed) {
          return;
        }
        setStats(nextStats);
        if (!nextStats.codeVolume.scope.isPartial) {
          return;
        }
        previousAnalyzed = nextAnalyzed;
      } catch {
        return;
      }
    }
  };

  const loadTechStack = async (login: string, requestId: number) => {
    try {
      const result = await fetchTechStack(login);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setTechStack(result);
    } catch {
      if (activeRequestRef.current === requestId) {
        setTechStack([]);
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSearch();
    }
  };

  const writeToClipboard = async (text: string): Promise<boolean> => {
    // navigator.clipboard is only available in secure contexts; the app is
    // served over plain HTTP, so fall back to a temporary textarea + execCommand.
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to the legacy path
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);
      return succeeded;
    } catch {
      return false;
    }
  };

  const copyToClipboard = async () => {
    if (!stats) return;
    const embedCode = getEmbedMarkdown(stats.login);
    const succeeded = await writeToClipboard(embedCode);
    if (!succeeded) {
      return;
    }
    setCopied(true);
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };
  const isCodeVolumeLoading = Boolean(
    stats &&
      stats.codeVolume.scope.isPartial &&
      stats.codeVolume.scope.commitLimit !== null &&
      stats.codeVolume.scope.commitLimit < FINAL_COMMIT_LIMIT
  );
  const codeMetricClassName = isCodeVolumeLoading
    ? 'metric-grid metric-grid-loading'
    : 'metric-grid';
  const codeMetrics = stats
    ? [
        { label: 'Lines added', value: stats.codeVolume.summary.additions },
        { label: 'Lines deleted', value: stats.codeVolume.summary.deletions },
        { label: 'Total changes', value: stats.codeVolume.summary.changes },
        { label: 'Files changed', value: stats.codeVolume.summary.filesChanged },
        { label: 'Commits analyzed', value: stats.codeVolume.summary.commitsAnalyzed },
        {
          label: 'Repositories analyzed',
          value: stats.codeVolume.summary.repositoriesAnalyzed,
        },
      ]
    : [];
  const issueYear = stats
    ? new Date(stats.range.to).getFullYear()
    : new Date().getFullYear();

  return (
    <div className="mag">
      <header className="masthead">
        <div className="masthead-meta">
          <span>Vol. 01</span>
          <span>The GitHub Issue</span>
          <span>Nº {issueYear}</span>
        </div>
        <h1 className="logo">Contrail</h1>
        <p className="tagline">
          A field study of one developer, told in commits, streaks &amp; the
          languages they keep.
        </p>
      </header>

      <div className="search" onKeyDown={handleSearchKeyDown}>
        <label className="search-label" htmlFor="handle">
          The Subject
        </label>
        <div className="search-row">
          <input
            id="handle"
            className="search-input"
            type="text"
            placeholder="github handle"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={state === 'loading'}
            autoComplete="off"
          />
          <button
            className="search-button"
            type="button"
            disabled={state === 'loading'}
            onClick={() => void handleSearch()}
          >
            {state === 'loading' ? 'Reading…' : 'Read'}
          </button>
        </div>
      </div>

      {state === 'loading' && (
        <div className="state-card">
          <span className="dot-loader" aria-hidden="true" />
          <p className="state-text">Developing the feature…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="state-card state-card-error">
          <p className="state-kicker">Off the record</p>
          <p className="state-text">{error}</p>
        </div>
      )}

      {state === 'success' && stats && (
        <div className="results">
          <section className="cover">
            {stats.avatarUrl ? (
              <img
                className="cover-avatar"
                src={stats.avatarUrl}
                alt={stats.name || stats.login}
              />
            ) : (
              <div className="cover-monogram" aria-hidden="true">
                {stats.name ? stats.name[0]?.toUpperCase() : '?'}
              </div>
            )}
            <div className="cover-text">
              <p className="cover-kicker">Cover Story</p>
              <h2 className="cover-name">{stats.name || stats.login}</h2>
              <p className="cover-handle">@{stats.login}</p>
              <p className="cover-dateline">
                {formatDate(stats.range.from)} — {formatDate(stats.range.to)}
              </p>
            </div>
          </section>

          <StatsCard stats={stats} />

          <div className="feature-grid">
            <figure className="feature">
              <figcaption className="feature-head">
                <span className="feature-no">02</span>
                <span className="feature-title">The Streak</span>
              </figcaption>
              <div className="figure-row">
                <span className="figure-label">Current streak</span>
                <span className="figure-value">
                  {formatNumber(stats.streaks.current)} days
                </span>
              </div>
              <div className="figure-row">
                <span className="figure-label">Max streak</span>
                <span className="figure-value">
                  {formatNumber(stats.streaks.max)} days
                </span>
              </div>
              <p className="feature-note">
                {stats.streaks.maxStartDate && stats.streaks.maxEndDate
                  ? `${stats.streaks.maxStartDate} → ${stats.streaks.maxEndDate}`
                  : 'No active streak in this range'}
              </p>
            </figure>

            <figure className="feature">
              <figcaption className="feature-head">
                <span className="feature-no">03</span>
                <span className="feature-title">작성 커밋 기준 코드 변경량</span>
              </figcaption>
              <p className="feature-note feature-scope">
                최근 {stats.codeVolume.scope.years}년,{' '}
                {stats.codeVolume.scope.commitLimit === null
                  ? '커밋 제한 없음'
                  : `최대 ${formatNumber(stats.codeVolume.scope.commitLimit)}커밋`}
                {isCodeVolumeLoading && <span className="inline-spinner" />}
              </p>
              <div className={codeMetricClassName}>
                {codeMetrics.map(({ label, value }) => (
                  <div className="metric-cell" key={label}>
                    <span className="metric-label">{label}</span>
                    <span className="metric-value">
                      {formatNumber(value)}
                      {isCodeVolumeLoading && (
                        <span className="loading-dots">…</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {stats.codeVolume.scope.isPartial && (
                <p className="feature-note partial-note">
                  Some repositories may be partial due to GitHub API limits.
                </p>
              )}
            </figure>
          </div>

          <section className="section-block">
            <h3 className="section-head">
              <span className="feature-no">04</span> 기술스택{' '}
              <span className="section-en">— The Wardrobe</span>
            </h3>
            <div className="panel">
              {techStack === null ? (
                <div className="techstack-loading">
                  <span className="dot-loader" aria-hidden="true" />
                  <p className="state-text">기술스택 분석 중…</p>
                </div>
              ) : (
                <TechTreemap items={techStack} />
              )}
            </div>
          </section>

          <section className="section-block">
            <h3 className="section-head">
              <span className="feature-no">05</span> 잔디{' '}
              <span className="section-en">— The Year in Green</span>
            </h3>
            <div className="panel">
              <ContributionGrid days={stats.calendar} />
            </div>
          </section>

          <section className="section-block embed-section">
            <h3 className="section-head">
              <span className="feature-no">06</span> 리드미에 넣기{' '}
              <span className="section-en">— The Clipping</span>
            </h3>
            <p className="feature-note">
              아래 마크다운을 GitHub README에 붙여넣으세요.
            </p>
            <div className="embed-code">
              <code>{getEmbedMarkdown(stats.login)}</code>
              <button
                className="copy-button"
                type="button"
                onClick={() => void copyToClipboard()}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        </div>
      )}

      {state === 'empty' && (
        <div className="empty-state">
          <p className="empty-kicker">Now Casting</p>
          <p className="empty-headline">
            Type a GitHub handle above to develop the feature.
          </p>
          <p className="empty-note">
            Nothing is stored on our servers. Every issue is printed on demand.
          </p>
        </div>
      )}

      <footer className="colophon">
        <span>Contrail</span>
        <nav className="colophon-links">
          <a href="https://github.com/zaewc" target="_blank" rel="noreferrer">
            @zaewc
          </a>
          <a
            href="https://github.com/zaewc/contrail"
            target="_blank"
            rel="noreferrer"
          >
            Repository
          </a>
          <a href="mailto:s24064@gsm.hs.kr">s24064@gsm.hs.kr</a>
        </nav>
      </footer>
    </div>
  );
};
