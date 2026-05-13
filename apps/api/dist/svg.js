function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function getColorIntensity(count) {
    if (count === 0)
        return '#0d1117';
    if (count <= 3)
        return '#0e4429';
    if (count <= 9)
        return '#006d32';
    if (count <= 20)
        return '#26a641';
    return '#39d353';
}
function renderContributionPreview(stats) {
    // Get last 52 weeks
    const sorted = [...stats.calendar].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last52weeks = sorted.slice(0, 364);
    // Create a grid of weeks (7 days per week)
    const cells = last52weeks
        .reverse()
        .map((day, idx) => {
        const x = (idx % 52) * 3;
        const y = (Math.floor(idx / 52)) * 3;
        const color = getColorIntensity(day.count);
        return `<rect x="${x}" y="${y}" width="2.5" height="2.5" fill="${color}" rx="0.3"/>`;
    })
        .join('');
    return `
    <g>
      <text x="0" y="12" font-size="10" font-weight="bold" fill="#c9d1d9">Contributions</text>
      <g transform="translate(0, 18)">
        ${cells}
      </g>
    </g>
  `;
}
export function renderStatsSvg(stats) {
    const bgColor = '#0d1117';
    const textColor = '#c9d1d9';
    const accentColor = '#39d353';
    const width = 450;
    const height = 320;
    const formatNumber = (n) => n.toLocaleString('en-US');
    const formatCompact = (n) => Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(n);
    const topStack = stats.techStack
        .slice(0, 3)
        .map((item) => item.name)
        .join(' · ') || 'N/A';
    const preview = renderContributionPreview(stats);
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
      .contrail-accent { fill: ${accentColor}; }
      .contrail-border { stroke: #30363d; stroke-width: 1; fill: none; }
      .contrail-title { font-size: 18px; font-weight: bold; }
      .contrail-stat-value { font-size: 16px; font-weight: bold; }
      .contrail-stat-label { font-size: 10px; }
    </style>
  </defs>

  <!-- Background -->
  <rect class="contrail-bg" width="${width}" height="${height}"/>

  <!-- Border -->
  <rect class="contrail-border" x="0" y="0" width="${width}" height="${height}"/>

  <!-- Header -->
  <text class="contrail-text contrail-title" x="20" y="30">contrail</text>
  <text class="contrail-text contrail-label" x="20" y="48">GitHub contribution stats</text>

  <!-- User Info -->
  <text class="contrail-text" x="20" y="75" font-size="14" font-weight="bold">${escapeXml(stats.login)}</text>
  <text class="contrail-text contrail-label" x="20" y="92">${escapeXml(stats.name || 'No name')} • Last 5 years</text>

  <!-- Stats Grid -->
  <g>
    <!-- Contributions -->
    <rect x="20" y="110" width="90" height="60" class="contrail-border" rx="4"/>
    <text class="contrail-text contrail-stat-value" x="30" y="140">${formatNumber(stats.totals.contributions)}</text>
    <text class="contrail-text contrail-stat-label" x="30" y="160">Contributions</text>

    <!-- Commits -->
    <rect x="120" y="110" width="90" height="60" class="contrail-border" rx="4"/>
    <text class="contrail-text contrail-stat-value" x="130" y="140">${formatNumber(stats.totals.commits)}</text>
    <text class="contrail-text contrail-stat-label" x="130" y="160">Commits</text>

    <!-- PRs -->
    <rect x="220" y="110" width="90" height="60" class="contrail-border" rx="4"/>
    <text class="contrail-text contrail-stat-value" x="230" y="140">${formatNumber(stats.totals.pullRequests)}</text>
    <text class="contrail-text contrail-stat-label" x="230" y="160">PRs</text>

    <!-- Issues -->
    <rect x="320" y="110" width="110" height="60" class="contrail-border" rx="4"/>
    <text class="contrail-text contrail-stat-value" x="330" y="140">${formatNumber(stats.totals.issues)}</text>
    <text class="contrail-text contrail-stat-label" x="330" y="160">Issues</text>

    <!-- Repositories -->
    <rect x="20" y="180" width="90" height="60" class="contrail-border" rx="4"/>
    <text class="contrail-text contrail-stat-value" x="30" y="210">${formatNumber(stats.totals.repositories)}</text>
    <text class="contrail-text contrail-stat-label" x="30" y="230">Repos</text>

    <!-- Advanced Summary -->
    <text class="contrail-text contrail-label" x="20" y="260">Max streak: ${formatNumber(stats.streaks.max)} days</text>
    <text class="contrail-text contrail-label" x="20" y="278">Code changes: ${formatCompact(stats.codeVolume.summary.changes)}</text>
    <text class="contrail-text contrail-label" x="20" y="296">Top stack: ${escapeXml(topStack)}</text>
  </g>

  <!-- Contribution Preview -->
  <g transform="translate(130, 190)">
    ${preview}
  </g>

  <!-- Footer -->
  <text class="contrail-text contrail-label" x="20" y="${height - 8}">Generated by contrail • github.com</text>
</svg>`;
    return svg;
}
