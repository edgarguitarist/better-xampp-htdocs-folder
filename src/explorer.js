// Explorador de archivos — módulo principal (SPA, multiselección, galería, árbol).
import { iconFor } from './icons.js';
import { humanSize, formatDate, kindLabel, kindOf } from './format.js';
import { renderPreview } from './preview.js';
import { initTree } from './tree.js';
import { openLightbox } from './lightbox.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Capacidades habilitadas en el backend (edit/delete/copy/move).
const CAPS = new Set((document.body.dataset.caps || '').split(',').filter(Boolean));

const state = {
  path: location.pathname,
  entries: [],
  view: localStorage.getItem('explorer:view') || 'details',
  sortKey: 'name',
  sortDir: 1,
  query: '',
  sel: new Set(),   // índices seleccionados dentro de _visible
  anchor: -1,       // ancla para selección por rango (Shift)
  cursor: -1,       // último índice enfocado
  previewOpen: localStorage.getItem('explorer:preview') !== 'off',
  treeOpen: localStorage.getItem('explorer:tree') !== 'off',
  clipboard: null, // solo en memoria: se limpia al recargar (no persiste)
  _visible: [],
};

const dom = {
  listing: $('#listing'),
  empty: $('#empty'),
  breadcrumb: $('#breadcrumb'),
  search: $('#search'),
  preview: $('#preview'),
  previewInner: $('#previewInner'),
  status: $('#statusbar'),
  filepane: $('#filepane'),
  tree: $('#tree'),
  workspace: $('#workspace'),
  btnPaste: $('#btnPaste'),
  btnNew: $('#btnNew'),
};

let tree = null;

/* ------------------------------ utilidades ------------------------------ */

function itemUrl(entry) {
  return state.path + encodeURIComponent(entry.name) + (entry.isDir ? '/' : '');
}

function parentPath(p) {
  const trimmed = p.replace(/\/+$/, '');
  if (!trimmed) return '/';
  return trimmed.slice(0, trimmed.lastIndexOf('/') + 1) || '/';
}

function visibleEntries() {
  const q = state.query.trim().toLowerCase();
  const list = state.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
  const { sortKey, sortDir } = state;
  list.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let r = 0;
    if (sortKey === 'size') r = (a.size || 0) - (b.size || 0);
    else if (sortKey === 'mtime') r = (a.mtime || 0) - (b.mtime || 0);
    else r = a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
    return r * sortDir;
  });
  return list;
}

function galleryImages() {
  return state._visible
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => kindOf(e) === 'image')
    .map(({ e, i }) => ({ name: e.name, url: itemUrl(e), i }));
}

/* ------------------------------ render ------------------------------ */

function renderBreadcrumb() {
  const parts = state.path.split('/').filter(Boolean);
  let acc = '/';
  const crumbs = [`<a href="/" data-nav="/">Inicio</a>`];
  for (const part of parts) {
    acc += part + '/';
    let label = part;
    try { label = decodeURIComponent(part); } catch { /* ruta malformada */ }
    crumbs.push(`<a href="${esc(acc)}" data-nav="${esc(acc)}">${esc(label)}</a>`);
  }
  dom.breadcrumb.innerHTML = crumbs.join('<span class="sep">›</span>');
}

function itemMarkup(entry, i) {
  const size = entry.isDir ? '' : humanSize(entry.size);
  const date = formatDate(entry.mtime);
  const name = esc(entry.name);
  const icon = iconFor(entry);
  const isImg = kindOf(entry) === 'image';
  const clip = clipClassFor(entry);

  if (state.view === 'grid' || state.view === 'gallery') {
    const big = state.view === 'gallery';
    const thumb = isImg
      ? `<img class="thumb" src="${itemUrl(entry)}" alt="" loading="lazy" />`
      : `<img class="thumb icon" src="${icon}" alt="" />`;
    return `<div class="item ${big ? 'gallery' : 'grid'}${clip}" role="option" data-i="${i}" tabindex="-1">
      <div class="thumb-wrap">${thumb}</div>
      <span class="name">${name}</span>
    </div>`;
  }
  if (state.view === 'details') {
    return `<div class="item details${clip}" role="option" data-i="${i}" tabindex="-1">
      <span class="cell name"><img class="icon" src="${icon}" alt="" />${name}</span>
      <span class="cell type">${kindLabel(entry)}</span>
      <span class="cell size">${size}</span>
      <span class="cell date">${date}</span>
    </div>`;
  }
  return `<div class="item list${clip}" role="option" data-i="${i}" tabindex="-1">
    <img class="icon" src="${icon}" alt="" /><span class="name">${name}</span>
    <span class="size">${size}</span>
  </div>`;
}

// Clase para distinguir elementos en el portapapeles (copiados/cortados).
function clipClassFor(entry) {
  if (!state.clipboard) return '';
  const url = itemUrl(entry);
  if (state.clipboard.items.some((it) => it.path === url)) {
    return state.clipboard.mode === 'cut' ? ' clip-cut' : ' clip-copy';
  }
  return '';
}

function detailsHeader() {
  const arrow = (k) => (state.sortKey === k ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '');
  return `<div class="details-head" role="row">
    <span class="cell name" data-sort="name">Nombre${arrow('name')}</span>
    <span class="cell type">Tipo</span>
    <span class="cell size" data-sort="size">Tamaño${arrow('size')}</span>
    <span class="cell date" data-sort="mtime">Modificado${arrow('mtime')}</span>
  </div>`;
}

function render() {
  hideTip();
  dom.listing.className = 'listing view-' + state.view;
  const list = visibleEntries();
  state._visible = list;

  if (!list.length) {
    dom.listing.innerHTML = '';
    dom.empty.hidden = false;
    dom.empty.textContent = state.query
      ? `Sin resultados para «${state.query}»`
      : 'Esta carpeta está vacía';
  } else {
    dom.empty.hidden = true;
    const head = state.view === 'details' ? detailsHeader() : '';
    dom.listing.innerHTML = head + list.map(itemMarkup).join('');
  }

  applySelection();
  renderStatus();
}

function renderStatus() {
  const list = state._visible;
  const dirs = list.filter((e) => e.isDir).length;
  const files = list.length - dirs;
  const bytes = list.reduce((s, e) => s + (e.size || 0), 0);
  let msg = `${list.length} elemento${list.length === 1 ? '' : 's'}`;
  if (dirs) msg += ` · ${dirs} carpeta${dirs === 1 ? '' : 's'}`;
  if (files) msg += ` · ${files} archivo${files === 1 ? '' : 's'}`;
  if (bytes) msg += ` · ${humanSize(bytes)}`;
  if (state.sel.size > 1) msg += `  ·  ${state.sel.size} seleccionados`;
  dom.status.textContent = msg;
}

/* ------------------------------ selección ------------------------------ */

function applySelection() {
  dom.listing.querySelectorAll('.item.selected').forEach((n) => n.classList.remove('selected'));
  for (const i of state.sel) {
    const node = dom.listing.querySelector(`.item[data-i="${i}"]`);
    if (node) node.classList.add('selected');
  }
  const cur = dom.listing.querySelector(`.item[data-i="${state.cursor}"]`);
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}

function afterSelectionChange() {
  applySelection();
  renderStatus();
  if (!state.previewOpen) return;
  const list = state._visible;
  if (state.sel.size === 0) renderPreview(dom.previewInner, null);
  else if (state.sel.size === 1) {
    const entry = list[[...state.sel][0]];
    renderPreview(dom.previewInner, entry, itemUrl(entry));
  } else {
    renderBatchPreview([...state.sel].map((i) => list[i]).filter(Boolean));
  }
}

function selectOnly(i) { state.sel = new Set([i]); state.anchor = i; state.cursor = i; afterSelectionChange(); }
function toggleSel(i) {
  if (state.sel.has(i)) state.sel.delete(i); else state.sel.add(i);
  state.anchor = i; state.cursor = i; afterSelectionChange();
}
function rangeSel(i) {
  const [a, b] = [state.anchor < 0 ? i : state.anchor, i].sort((x, y) => x - y);
  state.sel = new Set();
  for (let k = a; k <= b; k++) state.sel.add(k);
  state.cursor = i; afterSelectionChange();
}
function selectAll() {
  state.sel = new Set(state._visible.map((_, i) => i));
  afterSelectionChange();
}
function clearSel() { state.sel = new Set(); state.anchor = -1; state.cursor = -1; afterSelectionChange(); }

function renderBatchPreview(entries) {
  const files = entries.filter((e) => !e.isDir);
  const bytes = files.reduce((s, e) => s + (e.size || 0), 0);
  dom.previewInner.innerHTML = `
    <div class="pv-head">
      <div class="pv-badge">${entries.length}</div>
      <div class="pv-title">
        <strong>${entries.length} elementos</strong>
        <span class="pv-meta">${files.length} archivo(s) · ${humanSize(bytes)}</span>
      </div>
    </div>
    <ul class="pv-list">${entries.map((e) =>
      `<li><img src="${iconFor(e)}" alt="" />${esc(e.name)}</li>`).join('')}</ul>
    <p class="pv-note">Clic derecho sobre la selección para acciones.</p>`;
}

/* ------------------------------ activación / navegación ------------------------------ */

function activate(entry) {
  if (entry.isDir) navigate(itemUrl(entry));
  else window.open(itemUrl(entry), '_blank', 'noopener');
}

function navigate(path) {
  if (path === state.path) return;
  history.pushState({}, '', path);
  loadPath(path);
}

async function loadPath(path) {
  state.path = path;
  state.query = '';
  dom.search.value = '';
  clearSelSilent();
  renderBreadcrumb();
  dom.filepane.scrollTop = 0;
  dom.status.textContent = 'Cargando…';
  document.title = (path === '/' ? 'Inicio' : decodeURIComponent(path.replace(/\/$/, '').split('/').pop())) + ' · Explorador';
  try {
    const res = await fetch('/src/api.php?__api=list&path=' + encodeURIComponent(path));
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.entries = data.entries || [];
  } catch {
    state.entries = [];
    dom.status.textContent = 'Error al cargar la carpeta';
  }
  render();
  if (state.previewOpen) renderPreview(dom.previewInner, null);
  if (tree) tree.setActive(path);
}

function clearSelSilent() { state.sel = new Set(); state.anchor = -1; state.cursor = -1; }

/* ------------------------------ vista / paneles / tema ------------------------------ */

function setView(v) {
  state.view = v;
  localStorage.setItem('explorer:view', v);
  document.querySelectorAll('.view-toggle .icon-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === v));
  render();
}

function setPreviewOpen(open) {
  state.previewOpen = open;
  localStorage.setItem('explorer:preview', open ? 'on' : 'off');
  dom.preview.hidden = !open;
  document.body.classList.toggle('no-preview', !open);
  $('#btnPreview').classList.toggle('active', open);
  if (open) afterSelectionChange();
}

function setTreeOpen(open) {
  state.treeOpen = open;
  localStorage.setItem('explorer:tree', open ? 'on' : 'off');
  dom.tree.hidden = !open;
  document.body.classList.toggle('no-tree', !open);
  $('#btnTree').classList.toggle('active', open);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('explorer:theme', theme);
  const dark = theme === 'dark';
  $('#btnTheme').innerHTML = dark
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.1 22c-5.5 0-10-4.5-10-10 0-4.9 3.5-9 8.3-9.9-1 1.5-1.4 3.2-1.4 5 0 5 4.1 9.1 9.1 9.1.8 0 1.6-.1 2.4-.3-1.5 3.6-5 6.1-8.4 6.1z"/></svg>';
}

function initTheme() {
  const saved = localStorage.getItem('explorer:theme');
  applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}

/* ------------------------------ paneles redimensionables ------------------------------ */

const WIDTHS = {
  tree: { cssVar: '--tree-w', key: 'explorer:treeW', min: 160, max: 520 },
  preview: { cssVar: '--preview-w', key: 'explorer:previewW', min: 280, max: 700 },
};

const clampW = (cfg, v) => Math.max(cfg.min, Math.min(cfg.max, v));

function applySavedWidths() {
  for (const cfg of Object.values(WIDTHS)) {
    const v = parseInt(localStorage.getItem(cfg.key), 10);
    if (v) document.documentElement.style.setProperty(cfg.cssVar, clampW(cfg, v) + 'px');
  }
}

function startResize(e, handle) {
  e.preventDefault();
  const cfg = WIDTHS[handle.dataset.resize];
  const rect = dom.workspace.getBoundingClientRect();
  const isTree = handle.dataset.resize === 'tree';
  handle.classList.add('active');
  document.body.classList.add('resizing');
  handle.setPointerCapture?.(e.pointerId);

  let last = 0;
  const move = (ev) => {
    last = clampW(cfg, isTree ? ev.clientX - rect.left : rect.right - ev.clientX);
    document.documentElement.style.setProperty(cfg.cssVar, last + 'px');
  };
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.classList.remove('active');
    document.body.classList.remove('resizing');
    if (last) localStorage.setItem(cfg.key, String(last));
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
}

function initResizers() {
  applySavedWidths();
  document.querySelectorAll('.resizer').forEach((r) =>
    r.addEventListener('pointerdown', (e) => startResize(e, r)));
}

/* ------------------------------ operaciones de archivo ------------------------------ */

function selectionItems() {
  return [...state.sel]
    .map((i) => state._visible[i])
    .filter(Boolean)
    .map((e) => ({ path: itemUrl(e), name: e.name }));
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Overlay con spinner para operaciones que pueden tardar. Devuelve la función de cierre.
function showBusy(message) {
  const ov = document.createElement('div');
  ov.className = 'busy-overlay';
  ov.innerHTML = `<div class="busy-box"><div class="spinner"></div><p>${esc(message)}</p></div>`;
  document.body.append(ov);
  return () => ov.remove();
}

function confirmDialog(message, { danger = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal">
      <p>${esc(message)}</p>
      <div class="modal-actions">
        <button class="btn" data-no>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : ''}" data-yes>${danger ? 'Eliminar' : 'Aceptar'}</button>
      </div>
    </div>`;
    document.body.append(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector('[data-yes]').onclick = () => done(true);
    ov.querySelector('[data-no]').onclick = () => done(false);
    ov.addEventListener('click', (e) => { if (e.target === ov) done(false); });
    ov.querySelector('[data-yes]').focus();
  });
}

function promptDialog(message, value = '', { selectBase = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal">
      <p>${esc(message)}</p>
      <input class="modal-input" type="text" spellcheck="false" autocomplete="off" />
      <div class="modal-actions">
        <button class="btn" data-no>Cancelar</button>
        <button class="btn btn-primary" data-yes>Aceptar</button>
      </div>
    </div>`;
    document.body.append(ov);
    const input = ov.querySelector('.modal-input');
    input.value = value;
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector('[data-yes]').onclick = () => done(input.value.trim() || null);
    ov.querySelector('[data-no]').onclick = () => done(null);
    ov.addEventListener('click', (e) => { if (e.target === ov) done(null); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim() || null); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    input.focus();
    const dot = value.lastIndexOf('.');
    if (selectBase && dot > 0) input.setSelectionRange(0, dot); else input.select();
  });
}

async function createEntry(isDir) {
  if (!CAPS.has('create')) return;
  const name = await promptDialog(
    isDir ? 'Nombre de la nueva carpeta' : 'Nombre del nuevo archivo',
    isDir ? 'nueva carpeta' : 'nuevo archivo.txt',
    { selectBase: !isDir },
  );
  if (!name) return;
  const action = isDir ? 'mkdir' : 'mkfile';
  try {
    const res = await fetch(`/src/api.php?__api=${action}&path=${encodeURIComponent(state.path)}&name=${encodeURIComponent(name)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) { toast(data.error || 'No se pudo crear'); return; }
    toast(isDir ? 'Carpeta creada' : 'Archivo creado');
    await refresh();
  } catch { toast('No se pudo crear'); }
}

async function renameEntry(entry) {
  if (!CAPS.has('rename') || !entry) return;
  const name = await promptDialog('Nuevo nombre', entry.name, { selectBase: !entry.isDir });
  if (!name || name === entry.name) return;
  try {
    const res = await fetch(`/src/api.php?__api=rename&path=${encodeURIComponent(itemUrl(entry))}&name=${encodeURIComponent(name)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) { toast(data.error || 'No se pudo renombrar'); return; }
    toast('Renombrado');
    await refresh();
  } catch { toast('No se pudo renombrar'); }
}

// Formatos que PHP extrae sin dependencias externas (zlib + Phar del núcleo).
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'tgz']);
const isArchive = (e) => !e.isDir && (ARCHIVE_EXT.has(e.ext) || /\.tar\.gz$/i.test(e.name));

// input de archivo oculto para "Subir archivos"
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.multiple = true;
fileInput.style.display = 'none';
document.body.append(fileInput);
fileInput.addEventListener('change', () => { const f = [...fileInput.files]; fileInput.value = ''; uploadFiles(f); });
const pickUpload = () => fileInput.click();

async function uploadFiles(files) {
  if (!CAPS.has('upload') || !files.length) return;
  const done = showBusy(`Subiendo ${files.length} archivo${files.length === 1 ? '' : 's'}…`);
  let fail = 0;
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/src/api.php?__api=upload&path=' + encodeURIComponent(state.path), { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) fail++;
    } catch { fail++; }
  }
  done();
  toast(fail ? `${fail} no se pudieron subir` : `Subido${files.length === 1 ? '' : 's'} ✓`);
  await refresh();
}

async function extractEntry(entry) {
  if (!CAPS.has('extract') || !entry) return;
  const done = showBusy('Extrayendo «' + entry.name + '»…');
  try {
    const res = await fetch('/src/api.php?__api=extract&path=' + encodeURIComponent(itemUrl(entry)), { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) { toast(data.error || 'No se pudo extraer'); return; }
    toast('Extraído en «' + data.name + '»');
    await refresh();
  } catch { toast('No se pudo extraer'); }
  finally { done(); }
}

async function refresh() {
  try {
    const res = await fetch('/src/api.php?__api=list&path=' + encodeURIComponent(state.path));
    const data = await res.json();
    state.entries = data.entries || [];
  } catch { /* conserva lo que haya */ }
  clearSelSilent();
  render();
  if (state.previewOpen) renderPreview(dom.previewInner, null);
  if (tree && tree.reload) tree.reload(state.path);
}

async function deletePaths(items) {
  if (!CAPS.has('delete') || !items.length) return;
  const label = items.length === 1 ? `«${items[0].name}»` : `${items.length} elementos`;
  const ok = await confirmDialog(`¿Eliminar ${label}? Esta acción no se puede deshacer.`, { danger: true });
  if (!ok) return;
  let fail = 0;
  for (const it of items) {
    try {
      const res = await fetch('/src/api.php?__api=delete&path=' + encodeURIComponent(it.path), { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) fail++;
    } catch { fail++; }
  }
  toast(fail ? `No se pudieron eliminar ${fail}` : 'Eliminado');
  await refresh();
}

function setClipboardItems(items, mode) {
  const cap = mode === 'cut' ? 'move' : 'copy';
  if (!items.length || !CAPS.has(cap)) return;
  state.clipboard = { items, mode };
  updatePasteBtn();
  render(); // reflejar el estilo de copiado/cortado en el listado
  toast(`${mode === 'cut' ? 'Cortado' : 'Copiado'}: ${items.length} elemento${items.length === 1 ? '' : 's'}`);
}

async function doPaste(dest = state.path) {
  const clip = state.clipboard;
  if (!clip || !clip.items.length) return;
  const action = clip.mode === 'cut' ? 'move' : 'copy';
  if (!CAPS.has(action)) return;
  let fail = 0;
  for (const it of clip.items) {
    try {
      const url = `/src/api.php?__api=${action}&path=${encodeURIComponent(it.path)}&dest=${encodeURIComponent(dest)}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) fail++;
    } catch { fail++; }
  }
  if (clip.mode === 'cut') { state.clipboard = null; updatePasteBtn(); }
  toast(fail ? `No se pudo pegar ${fail}` : 'Pegado');
  await refresh();
}

function updatePasteBtn() {
  const clip = state.clipboard;
  const cap = clip ? (clip.mode === 'cut' ? 'move' : 'copy') : null;
  const show = !!clip && CAPS.has(cap);
  dom.btnPaste.hidden = !show;
  if (show) {
    const n = clip.items.length;
    $('#pasteLabel').textContent = 'Pegar' + (n > 1 ? ` (${n})` : '');
  }
}

/* ------------------------------ menú contextual ------------------------------ */

const itemsOf = (entries) => entries.map((e) => ({ path: itemUrl(e), name: e.name }));
const editableKind = (e) => { const k = kindOf(e); return k === 'text' || k === 'markdown'; };

function downloadEntries(entries) {
  entries.filter((e) => !e.isDir).forEach((e, k) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = itemUrl(e); a.download = e.name;
    document.body.append(a); a.click(); a.remove();
  }, k * 250));
}

async function copyPaths(entries) {
  const text = entries.map((e) => location.origin + itemUrl(e)).join('\n');
  try { await navigator.clipboard.writeText(text); toast('Ruta copiada'); }
  catch { toast('No se pudo copiar'); }
}

function editEntry(entry) {
  const i = state._visible.indexOf(entry);
  if (i >= 0) selectOnly(i);
  requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('explorer:edit')));
}

const CI = {
  open: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5zm14-9h-4V3H9v8H5l7 7z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12M8 13h8v-2H8zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.6 8.5A3 3 0 1 0 8 9.9l1.9 1.9-1.9 1.9a3 3 0 1 0 1.4 1.4L21 5.4V4h-1.6zM6 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2m0 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2m8.6-5.5L21 20.6V19h-1.6l-3.4-3.4z"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 2h-4.2A3 3 0 0 0 9.2 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 18H5V4h2v3h10V4h2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
  rename: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m21.4 11.6-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8M6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8"/></svg>',
  newfile: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zm4 14h-3v3h-2v-3H9v-2h3v-3h2v3h3zM13 9V4.5L18.5 10z"/></svg>',
  newfolder: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-1 8h-2v2h-2v-2h-2v-2h2v-2h2v2h2z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5zm7-16-5.5 5.5L8 11l3-3v9h2V8l3 3 1.5-1.5z"/></svg>',
  extract: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-6 10h-4v-2h4zm0-4h-4v-2h4zm0-4h-4V6h4z"/></svg>',
  all: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h2V3a2 2 0 0 0-2 2m8-2h-2v2h2zm6 0h-2v2h2zm2 2h2a2 2 0 0 0-2-2M3 13h2v-2H3zm0 6a2 2 0 0 0 2-2H3zm4 0h2v-2H7zm12-2h-2a2 2 0 0 0 2 2zm0-4h2v-2h-2zM3 9h2V7H3zm8 12h2v-2h-2zm8-8h2v-2h-2zm0 4h2v-2h-2zm-4 4h2v-2h-2zm2-16h-2v2h2zM7 5h2V3H7zm0 8h2v-2H7zm4-2h2v-2h-2zm0-4h2V5h-2z"/></svg>',
};

let ctxHandlersOn = false;
const ctxOnPointerDown = (e) => { if (!e.target.closest('.ctx-menu')) closeContextMenu(); };

function closeContextMenu() {
  document.querySelector('.ctx-menu')?.remove();
  if (ctxHandlersOn) {
    document.removeEventListener('pointerdown', ctxOnPointerDown, true);
    window.removeEventListener('scroll', closeContextMenu, true);
    window.removeEventListener('resize', closeContextMenu);
    ctxHandlersOn = false;
  }
}

function openContextMenu(x, y, items) {
  closeContextMenu();
  hideTip(); // no dejar el tooltip encima del menú
  if (!items.length) return;
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  for (const it of items) {
    if (it.separator) { const s = document.createElement('div'); s.className = 'ctx-sep'; menu.append(s); continue; }
    const b = document.createElement('button');
    b.className = 'ctx-item' + (it.danger ? ' danger' : '');
    b.innerHTML = `<span class="ctx-ico">${it.icon || ''}</span><span>${esc(it.label)}</span>`;
    b.addEventListener('click', () => { closeContextMenu(); it.action(); });
    menu.append(b);
  }
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
  setTimeout(() => {
    document.addEventListener('pointerdown', ctxOnPointerDown, true);
    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);
    ctxHandlersOn = true;
  }, 0);
}

function buildItemMenu(entries) {
  const items = [];
  const single = entries.length === 1 ? entries[0] : null;
  const anyFile = entries.some((e) => !e.isDir);

  if (single) items.push({ label: 'Abrir', icon: CI.open, action: () => activate(single) });
  if (single && isArchive(single) && CAPS.has('extract'))
    items.push({ label: 'Extraer aquí', icon: CI.extract, action: () => extractEntry(single) });
  if (anyFile) items.push({ label: 'Descargar', icon: CI.download, action: () => downloadEntries(entries) });
  if (single && !single.isDir && editableKind(single) && CAPS.has('edit'))
    items.push({ label: 'Editar', icon: CI.edit, action: () => editEntry(single) });
  if (single && CAPS.has('rename'))
    items.push({ label: 'Renombrar', icon: CI.rename, action: () => renameEntry(single) });
  items.push({ label: 'Copiar ruta', icon: CI.link, action: () => copyPaths(entries) });

  if (CAPS.has('copy') || CAPS.has('move')) items.push({ separator: true });
  if (CAPS.has('copy')) items.push({ label: 'Copiar', icon: CI.copy, action: () => setClipboardItems(itemsOf(entries), 'copy') });
  if (CAPS.has('move')) items.push({ label: 'Cortar', icon: CI.cut, action: () => setClipboardItems(itemsOf(entries), 'cut') });
  if (single && single.isDir && state.clipboard && CAPS.has(state.clipboard.mode === 'cut' ? 'move' : 'copy'))
    items.push({ label: 'Pegar aquí', icon: CI.paste, action: () => doPaste(itemUrl(single)) });

  if (CAPS.has('delete')) {
    items.push({ separator: true });
    items.push({ label: 'Eliminar', icon: CI.trash, danger: true, action: () => deletePaths(itemsOf(entries)) });
  }
  return items;
}

function createMenuItems() {
  const items = [];
  if (CAPS.has('create')) {
    items.push({ label: 'Nuevo archivo', icon: CI.newfile, action: () => createEntry(false) });
    items.push({ label: 'Nueva carpeta', icon: CI.newfolder, action: () => createEntry(true) });
  }
  if (CAPS.has('upload')) {
    if (items.length) items.push({ separator: true });
    items.push({ label: 'Subir archivos', icon: CI.upload, action: pickUpload });
  }
  return items;
}

function buildEmptyMenu() {
  const items = [...createMenuItems()];
  const canPaste = state.clipboard && CAPS.has(state.clipboard.mode === 'cut' ? 'move' : 'copy');
  if (canPaste || state._visible.length) {
    if (items.length) items.push({ separator: true });
    if (canPaste) items.push({ label: 'Pegar', icon: CI.paste, action: () => doPaste() });
    if (state._visible.length) items.push({ label: 'Seleccionar todo', icon: CI.all, action: selectAll });
  }
  return items;
}

/* ------------------------------ teclado ------------------------------ */

function columns() {
  if (state.view !== 'grid' && state.view !== 'gallery') return 1;
  const items = dom.listing.querySelectorAll('.item');
  if (items.length < 2) return 1;
  const top = items[0].offsetTop;
  let c = 0;
  for (const it of items) { if (it.offsetTop !== top) break; c++; }
  return Math.max(1, c);
}

function onKey(e) {
  const list = state._visible;
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';

  if (e.key === 'Escape' && document.querySelector('.ctx-menu')) {
    e.preventDefault(); closeContextMenu(); return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !typing) {
    e.preventDefault(); selectAll(); return;
  }
  if (!typing) {
    if (e.key === 'F2' && state.sel.size === 1) {
      e.preventDefault(); renameEntry(state._visible[[...state.sel][0]]); return;
    }
    if (e.key === 'Delete' && state.sel.size) { e.preventDefault(); deletePaths(selectionItems()); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'c' && state.sel.size) { e.preventDefault(); setClipboardItems(selectionItems(), 'copy'); return; }
      if (k === 'x' && state.sel.size) { e.preventDefault(); setClipboardItems(selectionItems(), 'cut'); return; }
      if (k === 'v') { e.preventDefault(); doPaste(); return; }
    }
  }
  if (!typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /\S/.test(e.key)) {
    dom.search.focus(); return;
  }
  if (typing && e.key !== 'Escape' && e.key !== 'Enter' && !e.key.startsWith('Arrow')) return;

  const cols = columns();
  const move = (delta) => {
    e.preventDefault();
    let next = state.cursor < 0 ? 0 : state.cursor + delta;
    next = Math.max(0, Math.min(list.length - 1, next));
    if (e.shiftKey) rangeSel(next); else selectOnly(next);
  };

  switch (e.key) {
    case 'ArrowDown': move(cols); break;
    case 'ArrowUp': move(-cols); break;
    case 'ArrowRight': if (state.view === 'grid' || state.view === 'gallery') move(1); break;
    case 'ArrowLeft': if (state.view === 'grid' || state.view === 'gallery') move(-1); break;
    case 'Home': e.preventDefault(); selectOnly(0); break;
    case 'End': e.preventDefault(); selectOnly(list.length - 1); break;
    case 'Enter':
      if (state.cursor >= 0 && list[state.cursor]) { e.preventDefault(); activate(list[state.cursor]); }
      break;
    case 'Backspace':
      if (!typing) { e.preventDefault(); if (state.path !== '/') navigate(parentPath(state.path)); }
      break;
    case 'Escape':
      if (typing) dom.search.blur();
      else clearSel();
      break;
  }
}

/* ------------------------------ eventos ------------------------------ */

function onItemClick(e, item) {
  const i = +item.dataset.i;
  const entry = state._visible[i];
  if (!entry) return;
  if (e.ctrlKey || e.metaKey) { toggleSel(i); return; }
  if (e.shiftKey) { rangeSel(i); return; }
  // clic simple sin modificadores
  if (state.view === 'gallery' && kindOf(entry) === 'image') {
    const imgs = galleryImages();
    openLightbox(imgs, imgs.findIndex((x) => x.i === i));
    return;
  }
  if (entry.isDir) navigate(itemUrl(entry));
  else selectOnly(i);
}

function wire() {
  dom.listing.addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) { onItemClick(e, item); return; }
    const sortCell = e.target.closest('[data-sort]');
    if (sortCell) {
      const key = sortCell.dataset.sort;
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = 1; }
      render();
    }
  });
  dom.listing.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.item');
    if (item) { const en = state._visible[+item.dataset.i]; if (en) activate(en); }
  });

  dom.breadcrumb.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (a) { e.preventDefault(); navigate(a.dataset.nav); }
  });

  dom.search.addEventListener('input', () => { state.query = dom.search.value; clearSelSilent(); render(); });

  document.querySelectorAll('.view-toggle .icon-btn').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)));

  dom.btnPaste.addEventListener('click', () => doPaste());
  dom.btnNew.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openContextMenu(r.left, r.bottom + 4, createMenuItems());
  });

  // arrastrar y soltar archivos para subir
  if (CAPS.has('upload')) {
    dom.filepane.addEventListener('dragover', (e) => { e.preventDefault(); dom.filepane.classList.add('dragover'); });
    dom.filepane.addEventListener('dragleave', (e) => { if (!dom.filepane.contains(e.relatedTarget)) dom.filepane.classList.remove('dragover'); });
    dom.filepane.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.filepane.classList.remove('dragover');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) uploadFiles(files);
    });
  }

  // menú contextual (clic derecho sobre un archivo, la selección o el vacío)
  dom.filepane.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const itemEl = e.target.closest('.item');
    if (itemEl) {
      const i = +itemEl.dataset.i;
      if (!state.sel.has(i)) selectOnly(i);
      const entries = [...state.sel].map((k) => state._visible[k]).filter(Boolean);
      openContextMenu(e.clientX, e.clientY, buildItemMenu(entries));
    } else {
      openContextMenu(e.clientX, e.clientY, buildEmptyMenu());
    }
  });

  $('#btnUp').addEventListener('click', () => { if (state.path !== '/') navigate(parentPath(state.path)); });
  $('#btnPreview').addEventListener('click', () => setPreviewOpen(!state.previewOpen));
  $('#btnTree').addEventListener('click', () => setTreeOpen(!state.treeOpen));
  $('#btnTheme').addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  window.addEventListener('popstate', () => loadPath(location.pathname));
  document.addEventListener('keydown', onKey);
}

/* ------------------------------ tooltip ------------------------------ */

let tipEl = null, tipTimer = 0, tipXY = { x: 0, y: 0 };

function tooltipHtml(entry) {
  const parts = [`<strong>${esc(entry.name)}</strong>`, `<span>${esc(kindLabel(entry))}</span>`];
  if (!entry.isDir && entry.size != null) parts.push(`<span>${esc(humanSize(entry.size))}</span>`);
  parts.push(`<span>Modificado: ${esc(formatDate(entry.mtime))}</span>`);
  return parts.join('');
}

function positionTip() {
  const pad = 14, r = tipEl.getBoundingClientRect();
  let x = tipXY.x + pad, y = tipXY.y + pad;
  if (x + r.width > window.innerWidth - 6) x = tipXY.x - r.width - pad;
  if (y + r.height > window.innerHeight - 6) y = tipXY.y - r.height - pad;
  tipEl.style.left = Math.max(6, x) + 'px';
  tipEl.style.top = Math.max(6, y) + 'px';
}

function hideTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.hidden = true; tipEl._i = -1; } }

function initTooltip() {
  tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  tipEl.hidden = true;
  tipEl._i = -1;
  document.body.append(tipEl);

  dom.listing.addEventListener('mousemove', (e) => {
    tipXY = { x: e.clientX, y: e.clientY };
    const itemEl = e.target.closest('.item');
    if (!itemEl) { hideTip(); return; }
    const i = +itemEl.dataset.i;
    if (i === tipEl._i) { if (!tipEl.hidden) positionTip(); return; }
    tipEl._i = i;
    tipEl.hidden = true;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      const entry = state._visible[i];
      if (!entry) return;
      tipEl.innerHTML = tooltipHtml(entry);
      tipEl.hidden = false;
      positionTip();
    }, 350);
  });
  dom.listing.addEventListener('mouseleave', hideTip);
  dom.filepane.addEventListener('scroll', hideTip);
}

/* ------------------------------ selección por arrastre (rubber-band) ------------------------------ */

function initMarquee() {
  dom.filepane.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.item') || e.target.closest('.details-head')) return;
    if (document.querySelector('.ctx-menu, .modal-overlay')) return;

    const startX = e.clientX, startY = e.clientY;
    const adding = e.ctrlKey || e.metaKey;
    const baseSel = new Set(state.sel);
    let box = null, active = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!active && Math.hypot(dx, dy) < 6) return;
      if (!active) {
        active = true;
        hideTip();
        box = document.createElement('div');
        box.className = 'marquee';
        document.body.append(box);
        document.body.classList.add('marquee-active');
      }
      const x = Math.min(ev.clientX, startX), y = Math.min(ev.clientY, startY);
      const w = Math.abs(dx), h = Math.abs(dy);
      box.style.left = x + 'px'; box.style.top = y + 'px';
      box.style.width = w + 'px'; box.style.height = h + 'px';

      const sel = new Set(adding ? baseSel : []);
      dom.listing.querySelectorAll('.item').forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.left < x + w && r.right > x && r.top < y + h && r.bottom > y) sel.add(+n.dataset.i);
      });
      state.sel = sel;
      state.cursor = -1;
      applySelection();
      renderStatus();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (box) box.remove();
      document.body.classList.remove('marquee-active');
      if (!active) clearSel();          // clic simple en vacío = deseleccionar
      else afterSelectionChange();      // actualizar preview una sola vez al soltar
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* ------------------------------ init ------------------------------ */

initTheme();
setView(state.view);
setPreviewOpen(state.previewOpen);
setTreeOpen(state.treeOpen);
initResizers();
wire();
initTooltip();
initMarquee();
dom.btnNew.hidden = !(CAPS.has('create') || CAPS.has('upload'));
updatePasteBtn();
tree = initTree(dom.tree, { onNavigate: navigate, initialPath: state.path });
loadPath(state.path);
