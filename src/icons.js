// Resolución de iconos, reutilizando los SVG de /src/icons/.
// Devuelve la ruta del icono para una entrada (archivo o carpeta).

const ICON_DIR = '/src/icons/';

// Extensión -> nombre de icono (sin carpeta ni .svg)
const EXT_ICON = {
  // imágenes
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image',
  tif: 'image', tiff: 'image', webp: 'image', avif: 'image',
  ico: 'favicon', svg: 'svg',
  // web / código
  html: 'html', htm: 'html', xhtml: 'html',
  css: 'css', sass: 'sass', scss: 'sass',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'react', tsx: 'react_ts', ts: 'typescript', 'd.ts': 'typescript',
  json: 'json', xml: 'xml', mdx: 'mdx', pug: 'pug', astro: 'astro',
  vue: 'javascript', svelte: 'javascript',
  php: 'php', py: 'python', java: 'java', jar: 'jar', class: 'javaclass',
  sh: 'console', bat: 'console', ps1: 'powershell', cmd: 'console',
  sql: 'database', db: 'database', sqlite: 'database',
  // documentos
  md: 'readme', markdown: 'markdown', txt: 'document', rtf: 'document',
  doc: 'word', docx: 'word', xls: 'table', xlsx: 'table', csv: 'table',
  ppt: 'powerpoint', pptx: 'powerpoint', pdf: 'document',
  // audio / vídeo / archivos comprimidos / binarios
  mp3: 'audio', aac: 'audio', wma: 'audio', ogg: 'audio', wav: 'audio', flac: 'audio', m4a: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video', m4v: 'video', ogv: 'video',
  zip: 'zip', rar: 'zip', tar: 'zip', gz: 'zip', '7z': 'zip',
  exe: 'exe', apk: 'android', msi: 'exe',
  // fuentes / config
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font', eot: 'font',
  properties: 'settings', ini: 'settings', env: 'settings', yml: 'settings', yaml: 'settings',
  gradle: 'gradle', pro: 'prolog', todo: 'todo', log: 'log',
  'code-workspace': 'vscode',
};

// Patrón de nombre de carpeta -> icono de carpeta
const FOLDER_ICON = [
  [/^(apk|android)$/i, 'folder-android'],
  [/^(option|options)$/i, 'folder-tools'],
  [/^(font|fonts)$/i, 'folder-font'],
  [/^(css|style|styles)$/i, 'folder-css'],
  [/^(img|image|images|assets)$/i, 'folder-images'],
  [/^(include|includes)$/i, 'folder-include'],
  [/^(js|javascript|scripts?)$/i, 'folder-javascript'],
  [/^(main|app)$/i, 'folder-app'],
  [/^(gradle|\.gradle)$/i, 'folder-gradle'],
  [/^(public|publics)$/i, 'folder-public'],
  [/^(doc|docs)$/i, 'folder-docs'],
  [/^(example|examples)$/i, 'folder-examples'],
  [/^(test|tests|__tests__)$/i, 'folder-test'],
  [/^(event|events)$/i, 'folder-event'],
  [/^(api|apis)$/i, 'folder-api'],
  [/^(src|source|sources)$/i, 'folder-src'],
  [/^(lib|libs|vendor)$/i, 'folder-lib'],
  [/^(log|logs)$/i, 'folder-log'],
  [/^(debug|debugs)$/i, 'folder-debug'],
  [/^(build|builds|dist)$/i, 'folder-dist'],
  [/^(layout|layouts)$/i, 'folder-layout'],
  [/^(output|outputs)$/i, 'folder-review'],
  [/^(tmp|temp|temps)$/i, 'folder-temp'],
  [/^(generate|generated)$/i, 'folder-generator'],
  [/^(components?)$/i, 'folder-components'],
  [/^(config|configs)$/i, 'folder-config'],
  [/^(download|downloads)$/i, 'folder-download'],
  [/^(mail|mails)$/i, 'folder-mail'],
  [/^(theme|themes)$/i, 'folder-theme'],
  [/^(i18n|es|en|locale|locales)$/i, 'folder-i18n'],
  [/^PHPMailer$/i, 'folder-phpmailer'],
  [/^(graphql)$/i, 'folder-graphql'],
  [/^\.vscode$/i, 'folder-vscode'],
];

export function iconFor(entry) {
  if (entry.isDir) {
    for (const [rx, icon] of FOLDER_ICON) {
      if (rx.test(entry.name)) return ICON_DIR + icon + '.svg';
    }
    return ICON_DIR + 'folder-base.svg';
  }
  const ext = entry.ext || '';
  // extensiones compuestas (p.ej. .d.ts)
  if (entry.name.toLowerCase().endsWith('.d.ts')) return ICON_DIR + 'typescript.svg';
  return ICON_DIR + (EXT_ICON[ext] || 'file') + '.svg';
}
