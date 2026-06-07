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

// An editorial, tonal palette — warm ink, sepia and a single accent — instead
// of the old neon syntax-highlighting colors.
const colors = [
  '#1a1714',
  '#c8452d',
  '#3a352c',
  '#9a8f78',
  '#5c554a',
  '#b9b1a0',
  '#2a2620',
  '#d8d0bf',
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
                  stroke="var(--paper)"
                  strokeWidth={2}
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
              backgroundColor: 'var(--ink)',
              border: 'none',
              borderRadius: 0,
              color: 'var(--paper)',
              fontFamily: 'Archivo, sans-serif',
              fontSize: 12,
            }}
            // Recharts colors the item label with the cell's fill (dark inks),
            // which vanishes on the dark tooltip — force it to paper.
            itemStyle={{ color: 'var(--paper)' }}
            labelStyle={{ color: 'var(--paper)' }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};
