import { ContributionDay, StreakStats } from './types.js';

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function calculateStreaks(calendar: ContributionDay[]): StreakStats {
  if (calendar.length === 0) {
    return { current: 0, max: 0, maxStartDate: null, maxEndDate: null };
  }

  const counts = new Map(calendar.map((day) => [day.date, day.count]));
  const sortedDates = [...counts.keys()].sort();
  const start = sortedDates[0];
  const end = sortedDates[sortedDates.length - 1];

  let currentDate = start;
  let currentRun = 0;
  let currentRunStart: string | null = null;
  let max = 0;
  let maxStartDate: string | null = null;
  let maxEndDate: string | null = null;

  while (currentDate <= end) {
    const isActive = (counts.get(currentDate) ?? 0) > 0;
    if (isActive) {
      if (currentRun === 0) {
        currentRunStart = currentDate;
      }
      currentRun += 1;
      if (currentRun > max) {
        max = currentRun;
        maxStartDate = currentRunStart;
        maxEndDate = currentDate;
      }
    } else {
      currentRun = 0;
      currentRunStart = null;
    }
    currentDate = addDays(currentDate, 1);
  }

  let current = 0;
  if ((counts.get(end) ?? 0) > 0) {
    currentDate = end;
    while (currentDate >= start && (counts.get(currentDate) ?? 0) > 0) {
      current += 1;
      currentDate = addDays(currentDate, -1);
    }
  }

  return { current, max, maxStartDate, maxEndDate };
}
