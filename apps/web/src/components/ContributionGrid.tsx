import React from 'react';

import { ContributionDay } from '../api.js';

interface ContributionGridProps {
  days: ContributionDay[];
}

type NormalizedContributionDay = ContributionDay & {
  count: number;
  color: string;
};

type CurvePoint = {
  x: number;
  y: number;
};

const EMPTY_COLOR = '#0d1117';

const CELL_SIZE = 12;
const CELL_GAP = 4;
const STEP = CELL_SIZE + CELL_GAP;

// 화면 안에 들어오게 조절하는 값
const COLUMNS_PER_WAVE = 72;
const WAVE_HEIGHT = 120;
const ROW_GAP = 44;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function getCurvePoint(index: number): CurvePoint {
  const waveIndex = Math.floor(index / COLUMNS_PER_WAVE);
  const indexInWave = index % COLUMNS_PER_WAVE;

  const progress = indexInWave / (COLUMNS_PER_WAVE - 1);

  const isReverse = waveIndex % 2 === 1;

  const x = isReverse
    ? (COLUMNS_PER_WAVE - 1 - indexInWave) * STEP
    : indexInWave * STEP;

  const baseY = waveIndex * (WAVE_HEIGHT + ROW_GAP);

  // 부드러운 물결. 0 → 1 → 0 흐름
  const curveY = Math.sin(progress * Math.PI) * WAVE_HEIGHT;

  return {
    x,
    y: baseY + curveY,
  };
}

function getCurveSize(total: number) {
  if (total === 0) {
    return {
      width: 0,
      height: 0,
    };
  }

  const waveCount = Math.ceil(total / COLUMNS_PER_WAVE);

  return {
    width: COLUMNS_PER_WAVE * STEP,
    height: waveCount * (WAVE_HEIGHT + ROW_GAP) + CELL_SIZE,
  };
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ days }) => {
  const continuousDays = normalizeContinuousDays(days);
  const curveSize = getCurveSize(continuousDays.length);

  return (
    <div className="contribution-container contribution-curve-container">
      <div
        className="contribution-curve"
        style={{
          width: curveSize.width,
          height: curveSize.height,
        }}
      >
        {continuousDays.map((day, index) => {
          const point = getCurvePoint(index);

          return (
            <div
              key={day.date}
              className={`contribution-cell contribution-curve-cell contribution-cell-level-${getContributionLevel(day.count)}`}
              style={{
                left: point.x,
                top: point.y,
              }}
              title={`${day.date}: ${day.count} contributions`}
            />
          );
        })}
      </div>
    </div>
  );
};