import { GitHubStats } from './types.js';

// UnifrakturCook (700), subset to the letters in "contrail" and embedded as a
// data URI so the blackletter wordmark renders even when the card is shown as an
// <img> (e.g. in a GitHub README), where external font requests are blocked.
const BLACKLETTER_WOFF2_BASE64 =
  'd09GMgABAAAAAASAAA4AAAAACEgAAAQsB9sAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbEBwaBmAAZBEICoVshG4BNgIkAyQLFAAEIAWFDAcgG8MGKJ4FdsN1MLRMGEavz0GmRRFBcJmzu996Cn9IOmDXThXw0CNWOoYCHv+fx9PebzrLwQQ0E45mcAIW7KzwRKXkZrwwH6D+BwAdOP+X0xub7sDuamtK+Z7Pv0VzgbQ5WgRxLxwTMKA5rHeeSECYuTVQ0I/RItZYZx0yRHq0IQGMAEgIIglBwIAseQB5pLos921eYzWEiC6qvucBEMPeJKhmSAokMIFWIYAAL8cCQOg9/7+nAHrbAm9QEDvoaXzJAzJc8XVeSHE+iWAm6n56DsPgSVT6io2J4rrF5pljtplmhIhGQCspYPrEW3AZAu8AcQguVmXZnfUeN2W0lTFVYyVZNfWckjwGTxWxVjh5gfHlyMNUOo3oAgagsdp41I3CGgofYfRtimUJ/BLHjVpeARFxUGaMWrm3gyIWMJDagOiqG07yKIMmM/IamESOI3neIIfmgguYG5DZrO2g8vDbYY5DdG0O7M6gOniKJY5554LItzCfRyRXkLqUHdPgEa3NcR2ApT9C+qYuYZ/x+TyVvsjbYJsv/o4MacRnhDEMLgPSZ6K1pt8GfPdeiguBn4o2Did+nr08b1FnXfSZmR50Y7xYmsBOKPSx7/EiQ7/GbM4tWJ/kfQG2lyXFBlzXHtsud3ox4bGznHI9vXlHuGu8iYnLvYSxpQsHzEPcM+I3APppn3XwfukenTgruZliQoeDNac/X1/nFRomftLR+lvCqGUzZHP9QbUoj2m1kR4h3lYFssLMIOntVVHbtFsk0QAWHbMdtA5WNU71f6bXJBuEYU6Hck5/jvKKTxuXlhGvs+7J61Zu86CaC7i2zjM0TOKkY5TDrIMgVkYv5s/tjjWMw9fs0D/hrhYcGbNq/bWQ8RL0QhAB61wjanG3yKNUMtSijFaI1oDm0yq678xo+KTFrHZ8ZkuFv6wybjJSk7PyldsHjwMKRz0O4e8flvri3udIj+m1ER6VOagCW0QlDB277GahXmk8jpVuubEdrY1ZDoZcbCmVQBgKbtD9BfhrFJ7KUfD9KikjCYDnAYPjas0/7/+ektoh6Q9ukgQAAX6N+x+h/izoAIj8on739f++zQOzUoJqcKCXtpCqpWBVuVAqG2hkKCS4gX5bFlz985F8mcZ1pfNCLSmAeASXIUd0o1YuIBnjckxyzGgUgnIx5vFsW8SZpyyEkMgcKgaFpgMdmC4wMzE1AVgjoE2AwNDagMWg0ZvA0NHLfiFoCCoTAQcuJOKm/gYhINR/iRjkd0NwdAbVkUTCGYkE4ybm8Q8EfeBw8I9BoBB4zmBpOBpDi+H51jAZtyDUOHbMw6tiDEGkRU8aRPgAVkfbGO/fvQDvZASxNb9w4IHvLwENA8bB1OhU8QLKDyQ8nG5VPnU26/TwqB+wWKIdK54amht+Y+tpJKcLhiawpVRDDw0jtu8lAAAA';

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
      @font-face {
        font-family: 'ContrailBlackletter';
        font-style: normal;
        font-weight: 700;
        src: url(data:font/woff2;base64,${BLACKLETTER_WOFF2_BASE64}) format('woff2');
      }
      .contrail-bg { fill: ${bgColor}; }
      .contrail-text { fill: ${textColor}; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .contrail-label { font-size: 11px; fill: #8b949e; }
      .contrail-border { stroke: #30363d; stroke-width: 1; fill: none; }
      .contrail-title { font-size: 28px; font-weight: 700; font-family: 'ContrailBlackletter', 'Segoe UI', Tahoma, serif; }
      .contrail-stat-value { font-size: 16px; font-weight: bold; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .contrail-stat-label { font-size: 10px; font-family: 'Segoe UI', Tahoma, sans-serif; }
    </style>
  </defs>

  <!-- Background -->
  <rect class="contrail-bg" width="${width}" height="${height}"/>

  <!-- Border -->
  <rect class="contrail-border" x="0" y="0" width="${width}" height="${height}"/>

  <!-- Header: wordmark on the left, byline on the right, on one baseline -->
  <text class="contrail-text contrail-title" x="20" y="42">contrail</text>
  <text class="contrail-text contrail-label" x="${width - 20}" y="42" text-anchor="end">${escapeXml(stats.login)} • Last 5 years</text>

  <!-- Stats Grid -->
  <g>
    ${cells}
  </g>
</svg>`;

  return svg;
}
