import path from 'node:path';

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.swift': 'Swift',
  '.dart': 'Dart',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.xml': 'XML',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.dockerfile': 'Dockerfile',
  '.md': 'Markdown',
  '.mdx': 'MDX',
};

const EXCLUDED_LOCKFILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'Pipfile.lock',
  'composer.lock',
  'Gemfile.lock',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.mp4',
  '.mov',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
]);

const EXCLUDED_PREFIXES = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  'coverage/',
  'out/',
  'target/',
  'vendor/',
  '.generated/',
  'generated/',
];

export function shouldExcludeFromCodeVolume(filename: string): boolean {
  const normalized = filename.replace(/\\/g, '/');
  const basename = path.posix.basename(normalized);
  const lower = normalized.toLowerCase();

  if (EXCLUDED_LOCKFILES.has(basename)) {
    return true;
  }

  if (EXCLUDED_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }

  if (
    lower.includes('/node_modules/') ||
    lower.includes('/dist/') ||
    lower.includes('/build/') ||
    lower.includes('/.next/') ||
    lower.includes('/coverage/') ||
    lower.includes('/generated/') ||
    lower.includes('/.generated/')
  ) {
    return true;
  }

  if (
    lower.includes('.generated.') ||
    lower.includes('.gen.') ||
    lower.endsWith('.min.js') ||
    lower.endsWith('.min.css')
  ) {
    return true;
  }

  return EXCLUDED_EXTENSIONS.has(path.posix.extname(lower));
}

export function languageForFilename(filename: string): string {
  const basename = path.posix.basename(filename);
  if (basename === 'Dockerfile') {
    return 'Dockerfile';
  }

  const lower = basename.toLowerCase();
  if (lower.endsWith('.dockerfile')) {
    return 'Dockerfile';
  }

  return EXTENSION_TO_LANGUAGE[path.posix.extname(lower)] ?? 'Other';
}
