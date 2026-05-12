import React from 'react';

import { ContributionDay } from '../api.js';

interface ContributionGridProps {
  days: ContributionDay[];
}

type NormalizedContributionDay = ContributionDay & {
  count: number;
  color: string;
};

const EMPTY_COLOR = '#0d1117';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getContributionLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 9) return 2;
  if (count <= 20) return 3;
  return 4;
}

function normalizeContinuousDays(days: ContributionDay[]): NormalizedContributionDay[] {
  if (days.length === 0) return [];

  const sortedDays = [...days].sort(
    (a, b) => getLocalDate(a.date).getTime() - getLocalDate(b.date).getTime(),
  );

  const dayMap = new Map(sortedDays.map((day) => [day.date, day]));

  const firstContributionDay = sortedDays.find((day) => day.count > 0);
  const lastContributionDay = [...sortedDays].reverse().find((day) => day.count > 0);

  const first = firstContributionDay ?? sortedDays[0];
  const last = lastContributionDay ?? sortedDays[sortedDays.length - 1];

  const start = getLocalDate(first.date);
  start.setDate(start.getDate() - start.getDay());

  const end = getLocalDate(last.date);

  const result: NormalizedContributionDay[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const date = toDateKey(cursor);
    const day = dayMap.get(date);

    result.push({
      date,
      count: day?.count ?? 0,
      color: day?.color ?? EMPTY_COLOR,
    });
  }

  return result;
}

function getYearMarkers(days: NormalizedContributionDay[]) {
  const markers: Array<{ year: number; column: number }> = [];
  const seen = new Set<number>();

  days.forEach((day, index) => {
    const year = getLocalDate(day.date).getFullYear();

    if (!seen.has(year)) {
      seen.add(year);
      markers.push({
        year,
        column: Math.floor(index / 7),
      });
    }
  });

  return markers;
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ days }) => {
  const continuousDays = normalizeContinuousDays(days);
  const yearMarkers = getYearMarkers(continuousDays);

  return (
    <div className="contribution-container">
      <div className="contribution-scroll">
        <div className="contribution-year-markers">
          {yearMarkers.map(({ year, column }) => (
            <div
              key={year}
              className="contribution-year-marker"
              style={{ gridColumnStart: column + 1 }}
            >
              {year}
            </div>
          ))}
        </div>

        <div className="contribution-continuous-grid">
          {continuousDays.map((day) => (
            <div
              key={day.date}
              className={`contribution-cell contribution-cell-level-${getContributionLevel(day.count)}`}
              title={`${day.date}: ${day.count} contributions`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};