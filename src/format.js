// Utilidades de formato y categorización de tipos de archivo.

export function humanSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + units[i];
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleString('es', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'avif', 'ico', 'svg', 'tif', 'tiff']);
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma']);
const MARKDOWN = new Set(['md', 'markdown', 'mdx']);
const TEXT = new Set([
  'txt', 'log', 'csv', 'tsv', 'ini', 'env', 'conf', 'cfg', 'properties', 'todo',
  'html', 'htm', 'xhtml', 'xml', 'svg', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'json5', 'yml', 'yaml', 'toml',
  'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'sql', 'graphql', 'gql',
  'vue', 'svelte', 'astro', 'pug', 'gradle', 'pro', 'lock', 'gitignore', 'dockerfile',
]);

export function kindOf(entry) {
  if (entry.isDir) return 'dir';
  const e = entry.ext || '';
  if (IMAGE.has(e)) return 'image';
  if (VIDEO.has(e)) return 'video';
  if (AUDIO.has(e)) return 'audio';
  if (e === 'pdf') return 'pdf';
  if (MARKDOWN.has(e)) return 'markdown';
  if (TEXT.has(e)) return 'text';
  return 'binary';
}

const KIND_LABEL = {
  dir: 'Carpeta', image: 'Imagen', video: 'Vídeo', audio: 'Audio',
  pdf: 'Documento PDF', markdown: 'Markdown', text: 'Texto', binary: 'Archivo',
};

export function kindLabel(entry) {
  const k = kindOf(entry);
  if (k === 'text' && entry.ext) return entry.ext.toUpperCase() + ' · Texto';
  if (k === 'image' && entry.ext) return entry.ext.toUpperCase() + ' · Imagen';
  return KIND_LABEL[k] || 'Archivo';
}

// Lenguaje para el resaltador, según extensión.
export function langOf(ext) {
  const markup = new Set(['html', 'htm', 'xhtml', 'xml', 'svg', 'vue', 'svelte', 'astro']);
  if (markup.has(ext)) return 'markup';
  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') return 'css';
  if (ext === 'json' || ext === 'json5') return 'json';
  return 'code';
}
