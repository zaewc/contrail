import { GitHubStats } from './types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderStatsSvg(stats: GitHubStats): string {
  const bgColor = '#0d1117';
  const textColor = '#c9d1d9';
  const addColor = '#3fb950';
  const deleteColor = '#f85149';
  const width = 450;
  const height = 220;

  const formatNumber = (n: number) => n.toLocaleString('en-US');
  const formatCompact = (n: number) =>
    Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);

  // x positions for a 4-column grid within the 20px side margins.
  const columns = [20, 125, 230, 335];
  const cellWidth = 95;
  const cellHeight = 58;

  const renderCell = (
    x: number,
    y: number,
    value: string,
    label: string,
    valueColor: string = textColor
  ) => `
    <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" class="contrail-border" rx="4"/>
    <text class="contrail-stat-value" x="${x + 10}" y="${y + 33}" fill="${valueColor}">${value}</text>
    <text class="contrail-stat-label" x="${x + 10}" y="${y + 50}" fill="#8b949e">${label}</text>
  `;

  const row1Y = 72;
  const row2Y = row1Y + cellHeight + 12;

  const cells = [
    renderCell(columns[0], row1Y, formatNumber(stats.totals.contributions), 'Contributions'),
    renderCell(columns[1], row1Y, formatNumber(stats.totals.commits), 'Commits'),
    renderCell(columns[2], row1Y, formatNumber(stats.totals.pullRequests), 'PRs'),
    renderCell(columns[3], row1Y, formatNumber(stats.totals.issues), 'Issues'),
    renderCell(columns[0], row2Y, formatNumber(stats.streaks.current), 'Current streak'),
    renderCell(columns[1], row2Y, formatNumber(stats.streaks.max), 'Max streak'),
    renderCell(
      columns[2],
      row2Y,
      `+${formatCompact(stats.codeVolume.summary.additions)}`,
      'Lines added',
      addColor
    ),
    renderCell(
      columns[3],
      row2Y,
      `-${formatCompact(stats.codeVolume.summary.deletions)}`,
      'Lines deleted',
      deleteColor
    ),
  ].join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    <style>
      .contrail-bg { fill: ${bgColor}; }
      .contrail-text { fill: ${textColor}; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .contrail-label { font-size: 11px; fill: #8b949e; }
      .contrail-border { stroke: #30363d; stroke-width: 1; fill: none; }
      .contrail-title { font-size: 18px; font-weight: bold; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .contrail-stat-value { font-size: 16px; font-weight: bold; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .contrail-stat-label { font-size: 10px; font-family: 'Segoe UI', Tahoma, sans-serif; }
    </style>
  </defs>

  <!-- Background -->
  <rect class="contrail-bg" width="${width}" height="${height}"/>

  <!-- Border -->
  <rect class="contrail-border" x="0" y="0" width="${width}" height="${height}"/>

  <!-- Header -->
  <text class="contrail-text contrail-title" x="20" y="34">contrail</text>
  <text class="contrail-text contrail-label" x="20" y="54">${escapeXml(stats.login)} • Last 5 years</text>

  <!-- Stats Grid -->
  <g>
    ${cells}
  </g>
</svg>`;

  return svg;
}
