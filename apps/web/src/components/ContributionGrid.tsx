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

const EMPTY_COLOR = '#ebedf0';

const CELL_SIZE = 10;
const CELL_GAP = 4;
const WEEK_DAYS = 7;

const SPIRAL_PADDING = 48;

// 나선 모양 조절값
const SPIRAL_START_RADIUS = 24;
const SPIRAL_TURN_GAP = 110;
const WEEK_GAP = 15;

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

  // GitHub 잔디처럼 주 단위로 맞추기 위해 시작일을 일요일로 당김
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

function getSpiralCenterPoint(weekIndex: number): CurvePoint {
  let theta = 0;
  let radius = SPIRAL_START_RADIUS;

  for (let i = 0; i < weekIndex; i += 1) {
    radius = SPIRAL_START_RADIUS + (SPIRAL_TURN_GAP * theta) / (Math.PI * 2);

    const thetaStep = WEEK_GAP / Math.max(radius, 1);
    theta += thetaStep;
  }

  radius = SPIRAL_START_RADIUS + (SPIRAL_TURN_GAP * theta) / (Math.PI * 2);

  return {
    x: Math.cos(theta) * radius,
    y: Math.sin(theta) * radius,
  };
}

function getWeekTangentAngle(weekIndex: number): number {
  const current = getSpiralCenterPoint(weekIndex);
  const next = getSpiralCenterPoint(weekIndex + 1);

  return Math.atan2(next.y - current.y, next.x - current.x);
}

function getContributionPoint(index: number): CurvePoint {
  const weekIndex = Math.floor(index / WEEK_DAYS);
  const dayIndex = index % WEEK_DAYS;

  const center = getSpiralCenterPoint(weekIndex);
  const tangentAngle = getWeekTangentAngle(weekIndex);

  // 나선 진행 방향에 수직으로 7칸 펼침
  const normalAngle = tangentAngle + Math.PI / 2;

  // 0~6을 -3~3으로 보정해서 주 중심 기준으로 배치
  const dayOffset = dayIndex - Math.floor(WEEK_DAYS / 2);
  const distance = dayOffset * (CELL_SIZE + CELL_GAP);

  return {
    x: center.x + Math.cos(normalAngle) * distance,
    y: center.y + Math.sin(normalAngle) * distance,
  };
}

function getSpiralSize(total: number) {
  if (total === 0) {
    return {
      width: 0,
      height: 0,
    };
  }

  const weekCount = Math.ceil(total / WEEK_DAYS);
  const lastPoint = getSpiralCenterPoint(weekCount - 1);

  const maxRadius = Math.sqrt(lastPoint.x ** 2 + lastPoint.y ** 2);
  const bandRadius = ((WEEK_DAYS - 1) * (CELL_SIZE + CELL_GAP)) / 2;

  const size = Math.ceil((maxRadius + bandRadius) * 2 + SPIRAL_PADDING * 2 + CELL_SIZE);

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
      <svg
        className="contribution-curve"
        width={spiralSize.width}
        height={spiralSize.height}
        viewBox={`0 0 ${spiralSize.width} ${spiralSize.height}`}
        role="img"
        aria-label="Contribution activity shown as a spiral"
      >
        {continuousDays.map((day, index) => {
          const point = getContributionPoint(index);

          return (
            <rect
              key={day.date}
              className={`contribution-cell contribution-curve-cell contribution-cell-level-${getContributionLevel(day.count)}`}
              x={centerX + point.x - CELL_SIZE / 2}
              y={centerY + point.y - CELL_SIZE / 2}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
            >
              <title>{`${day.date}: ${day.count} contributions`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
};
