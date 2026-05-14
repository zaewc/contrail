import React from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  Treemap,
} from 'recharts';
import { TechStackItem } from '../api.js';

interface TechTreemapProps {
  items: TechStackItem[];
}

const colors = [
  '#39d353',
  '#79c0ff',
  '#d2a8ff',
  '#ffa657',
  '#ff7b72',
  '#56d4dd',
  '#a5d6ff',
  '#f2cc60',
];

export const TechTreemap: React.FC<TechTreemapProps> = ({ items }) => {
  const visibleItems = items.map((item, index) => ({
    ...item,
    fill: colors[index % colors.length],
    value: item.bytes,
  }));

  if (visibleItems.length === 0) {
    return <div className="metric-note">No language data available.</div>;
  }

  return (
    <div className="tech-treemap" role="img" aria-label="Technology stack treemap">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={visibleItems}
          dataKey="value"
          nameKey="name"
          type="flat"
          isAnimationActive={false}
          content={(props: any) => {
            const { x, y, width, height, name, percentage, fill } = props;
            const showLabel = width > 72 && height > 44;
            return (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fill}
                  stroke="var(--bg-secondary)"
                  strokeWidth={4}
                  rx={6}
                />
                {showLabel && (
                  <>
                    <text
                      x={x + 12}
                      y={y + 22}
                      className="tech-treemap-name"
                    >
                      {name}
                    </text>
                    <text
                      x={x + 12}
                      y={y + 42}
                      className="tech-treemap-percent"
                    >
                      {Number(percentage).toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            );
          }}
        >
          <Tooltip
            formatter={(_, __, payload) => {
              const item = payload.payload as TechStackItem;
              return [`${item.percentage.toFixed(1)}%`, item.name];
            }}
            contentStyle={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};
