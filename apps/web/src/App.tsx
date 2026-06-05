import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Heading,
  Result,
  Section,
  Spinner,
  Text,
  TextField,
} from '@zaemoru/react';
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

  return (
    <div className="container">
      <div className="header">
        <Heading className="header-title" level="1" size="3xl">
          contrail
        </Heading>
        <Text tone="muted" size="md">
          GitHub contribution intelligence
        </Text>
      </div>

      <div className="search-shell">
        <Card className="search-card" elevation="low" padding="none">
          <div
            className="search-section"
            onKeyDown={handleSearchKeyDown}
          >
            <TextField
              className="search-input"
              label="GitHub username"
              placeholder="Enter GitHub username..."
              value={input}
              onInput={(value) => setInput(value)}
              disabled={state === 'loading'}
            />
            <Button
              className="search-button"
              type="button"
              size="medium"
              fullWidth
              loading={state === 'loading'}
              disabled={state === 'loading'}
              onClick={() => void handleSearch()}
            >
              Analyze
            </Button>
          </div>
        </Card>
      </div>

      {state === 'loading' && (
        <Card className="state-card" elevation="low" padding="large">
          <Spinner size="medium" tone="primary" label="Loading your stats" />
        </Card>
      )}

      {state === 'error' && (
        <Result
          className="state-card"
          tone="danger"
          title="Error"
          description={error}
        />
      )}

      {state === 'success' && stats && (
        <div className="results">
          <Card className="profile" elevation="low" padding="large">
            <div className="profile-avatar">
              {stats.name ? stats.name[0]?.toUpperCase() : '?'}
            </div>
            <div className="profile-info">
              <Heading level="2" size="lg">{stats.name || stats.login}</Heading>
              <Badge variant="weak" size="small" color="blue">
                @{stats.login}
              </Badge>
              <Text className="range" tone="muted" size="sm">
                {formatDate(stats.range.from)} • {formatDate(stats.range.to)}
              </Text>
            </div>
          </Card>

          <StatsCard stats={stats} />

          <div className="analysis-grid">
            <Card className="analysis-card" elevation="low" padding="large">
              <Heading level="3" size="sm">Streak</Heading>
              <div className="metric-row">
                <Text tone="muted" size="sm">Current streak</Text>
                <strong>{formatNumber(stats.streaks.current)} days</strong>
              </div>
              <div className="metric-row">
                <Text tone="muted" size="sm">Max streak</Text>
                <strong>{formatNumber(stats.streaks.max)} days</strong>
              </div>
              <Text className="metric-note" tone="muted" size="sm">
                {stats.streaks.maxStartDate && stats.streaks.maxEndDate
                  ? `${stats.streaks.maxStartDate} → ${stats.streaks.maxEndDate}`
                  : 'No active streak in this range'}
              </Text>
            </Card>

            <Card className="analysis-card" elevation="low" padding="large">
              <Heading level="3" size="sm">작성 커밋 기준 코드 변경량</Heading>
              <Text className="scope-note" tone="muted" size="sm">
                최근 {stats.codeVolume.scope.years}년,{' '}
                {stats.codeVolume.scope.commitLimit === null
                  ? '커밋 제한 없음'
                  : `최대 ${formatNumber(stats.codeVolume.scope.commitLimit)}커밋`}
                {isCodeVolumeLoading && <span className="inline-spinner" />}
              </Text>
              <div className={codeMetricClassName}>
                {codeMetrics.map(({ label, value }) => (
                  <div key={label}>
                    <Text tone="muted" size="sm">{label}</Text>
                    <strong>
                      {formatNumber(value)}
                      {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                    </strong>
                  </div>
                ))}
              </div>
              {stats.codeVolume.scope.isPartial && (
                <Text className="partial-note" tone="muted" size="sm">
                  Some repositories may be partial due to GitHub API limits.
                </Text>
              )}
            </Card>
          </div>

          <Section className="section-block" title="기술스택" gap="medium">
            <Card className="analysis-card full-width" elevation="low" padding="large">
              {techStack === null ? (
                <div className="techstack-loading">
                  <Spinner />
                  <Text tone="muted" size="sm">기술스택 분석 중...</Text>
                </div>
              ) : (
                <TechTreemap items={techStack} />
              )}
            </Card>
          </Section>

          <Section className="section-block" title="잔디" gap="medium">
            <Card className="contribution-section" elevation="low" padding="large">
              <ContributionGrid days={stats.calendar} />
            </Card>
          </Section>

          <Card className="embed-section" elevation="low" padding="large">
            <Heading level="3" size="sm">리드미에 넣기</Heading>
            <Text className="embed-note" tone="muted" size="sm">
              아래 마크다운을 GitHub README에 붙여넣으세요.
            </Text>
            <div className="embed-code">
              <code>{getEmbedMarkdown(stats.login)}</code>
              <Button
                className="copy-button"
                variant="secondary"
                size="small"
                onClick={() => void copyToClipboard()}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {state === 'empty' && (
        <div className="empty-shell">
          <Card className="empty-state" elevation="low" padding="none">
            <div className="empty-state-content">
              <Badge variant="weak" size="small" color="green">
                Ready
              </Badge>
              <Heading level="2" size="md">
                Enter a GitHub username to get started
              </Heading>
              <Text tone="muted" size="sm">
                No data is stored on our servers. All analysis happens instantly.
              </Text>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
