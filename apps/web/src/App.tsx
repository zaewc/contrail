import React, { useRef, useState } from 'react';
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
import { fetchStats, getCardUrl, GitHubStats } from './api.js';
import { StatsCard } from './components/StatsCard.js';
import { ContributionGrid } from './components/ContributionGrid.js';
import { TechTreemap } from './components/TechTreemap.js';
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
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const activeRequestRef = useRef(0);

  const handleSearch = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    const login = input.trim();
    if (!login) {
      setError('Please enter a GitHub username');
      setState('error');
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setState('loading');
    setError('');
    setStats(null);

    try {
      const result = await fetchStats(login, INITIAL_COMMIT_LIMIT);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setStats(result);
      setState('success');
      void refreshStatsIncrementally(login, requestId, result);
    } catch (err) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setState('error');
    }
  };

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
        setStats(nextStats);

        if (!nextStats.codeVolume.scope.isPartial || nextAnalyzed <= previousAnalyzed) {
          break;
        }
        previousAnalyzed = nextAnalyzed;
      } catch {
        return;
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSearch(e);
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
  const isCodeVolumeLoading = Boolean(
    stats &&
      stats.codeVolume.scope.isPartial &&
      stats.codeVolume.scope.commitLimit !== null &&
      stats.codeVolume.scope.commitLimit < FINAL_COMMIT_LIMIT
  );
  const codeMetricClassName = isCodeVolumeLoading
    ? 'metric-grid metric-grid-loading'
    : 'metric-grid';

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

      <Card className="search-card" elevation="low" padding="large">
        <form
          className="search-section"
          onSubmit={handleSearch}
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
            size="large"
            loading={state === 'loading'}
            disabled={state === 'loading'}
            onClick={handleSearch}
          >
            Analyze
          </Button>
        </form>
      </Card>

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
                <div>
                  <Text tone="muted" size="sm">Lines added</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.additions)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
                <div>
                  <Text tone="muted" size="sm">Lines deleted</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.deletions)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
                <div>
                  <Text tone="muted" size="sm">Total changes</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.changes)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
                <div>
                  <Text tone="muted" size="sm">Files changed</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.filesChanged)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
                <div>
                  <Text tone="muted" size="sm">Commits analyzed</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.commitsAnalyzed)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
                <div>
                  <Text tone="muted" size="sm">Repositories analyzed</Text>
                  <strong>
                    {formatNumber(stats.codeVolume.summary.repositoriesAnalyzed)}
                    {isCodeVolumeLoading && <span className="loading-dots">...</span>}
                  </strong>
                </div>
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
              <TechTreemap items={stats.techStack} />
            </Card>
          </Section>

          <Section className="section-block" title="잔디" gap="medium">
            <Card className="contribution-section" elevation="low" padding="large">
              <ContributionGrid days={stats.calendar} />
            </Card>
          </Section>

          <Card className="embed-section" elevation="low" padding="large">
            <Heading level="3" size="sm">리드미에 넣기</Heading>
            <div className="embed-code">
              <code>![contrail]({getCardUrl(stats.login)})</code>
              <Button
                className="copy-button"
                variant="secondary"
                size="small"
                onClick={copyToClipboard}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {state === 'empty' && (
        <Result
          className="empty-state"
          tone="neutral"
          title="Enter a GitHub username to get started"
          description="No data is stored on our servers. All analysis happens instantly."
        />
      )}
    </div>
  );
};
