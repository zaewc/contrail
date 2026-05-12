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
const ROW_COUNT = 18;

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

function getSnakeGridPosition(index: number) {
  const column = Math.floor(index / ROW_COUNT);
  const rowInColumn = index % ROW_COUNT;

  const row = column % 2 === 0 ? rowInColumn : ROW_COUNT - 1 - rowInColumn;

  return {
    gridColumnStart: column + 1,
    gridRowStart: row + 1,
  };
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ days }) => {
  const continuousDays = normalizeContinuousDays(days);

  return (
    <div className="contribution-container">
      <div
        className="contribution-snake-grid"
        style={{
          gridTemplateRows: `repeat(${ROW_COUNT}, 12px)`,
        }}
      >
        {continuousDays.map((day, index) => (
          <div
            key={day.date}
            className={`contribution-cell contribution-cell-level-${getContributionLevel(day.count)}`}
            style={getSnakeGridPosition(index)}
            title={`${day.date}: ${day.count} contributions`}
          />
        ))}
      </div>
    </div>
  );
};