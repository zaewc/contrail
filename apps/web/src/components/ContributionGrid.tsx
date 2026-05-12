import React from 'react';
import { ContributionDay } from '../api.js';

interface ContributionGridProps {
  days: ContributionDay[];
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ days }) => {
  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 9) return 2;
    if (count <= 20) return 3;
    return 4;
  };

  // Sort all days by date
  const sortedDays = [...days].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Group days by year
  const daysByYear = new Map<number, ContributionDay[]>();
  for (const day of sortedDays) {
    const year = new Date(day.date).getFullYear();
    if (!daysByYear.has(year)) {
      daysByYear.set(year, []);
    }
    daysByYear.get(year)!.push(day);
  }

  // Only show years with at least one contribution
  const years = Array.from(daysByYear.keys())
    .filter((year) => {
      const yearDays = daysByYear.get(year) || [];
      return yearDays.some((d) => d.count > 0); // At least one contribution
    })
    .sort((a, b) => a - b);

  return (
    <div className="contribution-container">
      {years.map((year) => {
        const yearDays = daysByYear.get(year) || [];
        const daysWithContribution = yearDays.filter((d) => d.count > 0);
        
        if (daysWithContribution.length === 0) return null;

        return (
          <div key={year} className="contribution-year-row">
            <div className="contribution-year-label">{year}</div>
            <div className="contribution-year-grid">
              {yearDays.map((day) => (
                <div
                  key={day.date}
                  className={`contribution-cell contribution-cell-level-${getLevel(day.count)}`}
                  title={`${day.date}: ${day.count} contributions`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
