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

const CELL_SIZE = 10;
const CELL_GAP = 4;

// 나선형 모양 조절값
const SPIRAL_START_RADIUS = 16;
const SPIRAL_TURN_GAP = 18;
const SPIRAL_ANGLE_STEP = 0.28;
const SPIRAL_PADDING = 32;

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

function getSpiralPoint(index: number, total: number): CurvePoint {
  // 오래된 날짜가 바깥쪽, 최신 날짜가 안쪽으로 오게 뒤집음
  const reversedIndex = total - 1 - index;

  const angle = reversedIndex * SPIRAL_ANGLE_STEP;
  const radius = SPIRAL_START_RADIUS + SPIRAL_TURN_GAP * Math.sqrt(reversedIndex);

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getSpiralSize(total: number) {
  if (total === 0) {
    return {
      width: 0,
      height: 0,
    };
  }

  const maxRadius = SPIRAL_START_RADIUS + SPIRAL_TURN_GAP * Math.sqrt(total);
  const size = Math.ceil(maxRadius * 2 + SPIRAL_PADDING * 2 + CELL_SIZE);

  return {
    width: size,
    height: size,
  };
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ days }) => {
  const continuousDays = normalizeContinuousDays(days);
  const spiralSize = getSpiralSize(continuousDays.length);

  const centerX = spiralSize.width / 2;
  const centerY = spiralSize.height / 2;

  return (
    <div className="contribution-container contribution-curve-container">
      <div
        className="contribution-curve"
        style={{
          width: spiralSize.width,
          height: spiralSize.height,
        }}
      >
        {continuousDays.map((day, index) => {
          const point = getSpiralPoint(index, continuousDays.length);

          return (
            <div
              key={day.date}
              className={`contribution-cell contribution-curve-cell contribution-cell-level-${getContributionLevel(day.count)}`}
              style={{
                left: centerX + point.x,
                top: centerY + point.y,
              }}
              title={`${day.date}: ${day.count} contributions`}
            />
          );
        })}
      </div>
    </div>
  );
};