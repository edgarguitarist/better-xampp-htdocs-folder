// Panel de vista previa estilo Explorador: imágenes, vídeo, audio, PDF,
// texto/código con resaltado y Markdown renderizado.
import { kindOf, kindLabel, humanSize, formatDate, langOf } from './format.js';
import { iconFor } from './icons.js';
import { highlight, escapeHtml } from './highlight.js';
import { renderMarkdown } from './markdown.js';

const rawUrl = (urlPath) => '/src/api.php?__api=raw&path=' + encodeURIComponent(urlPath);
const saveUrl = (urlPath) => '/src/api.php?__api=save&path=' + encodeURIComponent(urlPath);

const isEditable = (kind) => kind === 'text' || kind === 'markdown';

// Referencia al archivo que se está previsualizando (para "Editar" desde el menú).
let current = null;

// Cabecera limpia: icono, nombre, meta y (solo archivos) un botón de descarga a la derecha.
function header(entry, urlPath, { download = false } = {}) {
  const size = entry.size != null ? humanSize(entry.size) : '';
  const meta = [kindLabel(entry), size, formatDate(entry.mtime)].filter(Boolean).join(' · ');
  const dl = download ? `
      <a class="icon-btn pv-download" href="${urlPath}" download title="Descargar" aria-label="Descargar">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5zm14-9h-4V3H9v8H5l7 7z"/></svg>
      </a>` : '';
  return `
    <div class="pv-head">
      <img class="pv-icon" src="${iconFor(entry)}" alt="" />
      <div class="pv-title">
        <strong title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</strong>
        <span class="pv-meta">${escapeHtml(meta)}</span>
      </div>${dl}
    </div>`;
}

async function textBody(entry, urlPath, opts = {}) {
  const res = await fetch(rawUrl(urlPath));
  const truncated = res.headers.get('X-Truncated') === '1';
  const text = await res.text();

  if (opts.markdown && !opts.showSource) {
    return `<div class="pv-md">${renderMarkdown(text)}</div>` +
      (truncated ? '<p class="pv-note">Vista previa truncada (archivo grande).</p>' : '');
  }

  const lang = opts.markdown ? 'code' : langOf(entry.ext);
  const highlighted = highlight(text, lang);
  const lineCount = text.split('\n').length;
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  return `
    <div class="pv-code">
      <pre class="pv-gutter" aria-hidden="true">${gutter}</pre>
      <pre class="pv-src"><code>${highlighted}</code></pre>
    </div>` + (truncated ? '<p class="pv-note">Vista previa truncada (archivo grande).</p>' : '');
}

export async function renderPreview(container, entry, urlPath) {
  if (!entry) {
    current = null;
    container.innerHTML = `<div class="pv-empty">
      <img src="/src/icons/folder-base.svg" alt="" />
      <p>Selecciona un archivo para previsualizarlo</p>
    </div>`;
    return;
  }
  if (entry.isDir) {
    current = { container, entry, urlPath, kind: 'dir' };
    container.innerHTML = header(entry, urlPath) + `<div class="pv-empty">
      <img src="${iconFor(entry)}" alt="" />
      <p>Carpeta · ábrela para ver su contenido</p>
      <p class="pv-note">Clic derecho para más acciones</p>
    </div>`;
    return;
  }

  const kind = kindOf(entry);
  current = { container, entry, urlPath, kind };
  container.innerHTML = header(entry, urlPath, { download: true }) + '<div class="pv-body" id="pvBody"></div>';
  const body = container.querySelector('#pvBody');

  try {
    switch (kind) {
      case 'image':
        body.innerHTML = `<div class="pv-media"><img id="pvImg" src="${urlPath}" alt="${escapeHtml(entry.name)}" /></div>`;
        {
          const img = body.querySelector('#pvImg');
          img.addEventListener('load', () => {
            const dim = document.createElement('p');
            dim.className = 'pv-note';
            dim.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
            body.appendChild(dim);
          });
        }
        break;
      case 'video':
        body.innerHTML = `<div class="pv-media"><video src="${urlPath}" controls preload="metadata"></video></div>`;
        break;
      case 'audio':
        body.innerHTML = `<div class="pv-media pv-audio"><audio src="${urlPath}" controls preload="metadata"></audio></div>`;
        break;
      case 'pdf':
        body.innerHTML = `<iframe class="pv-pdf" src="${urlPath}" title="${escapeHtml(entry.name)}"></iframe>`;
        break;
      case 'markdown': {
        body.innerHTML = `<div class="pv-toolbar"><button class="btn btn-sm" id="mdToggle">Ver código</button></div><div id="mdOut"></div>`;
        const out = body.querySelector('#mdOut');
        let showSource = false;
        const paint = async () => { out.innerHTML = await textBody(entry, urlPath, { markdown: true, showSource }); };
        body.querySelector('#mdToggle').addEventListener('click', (e) => {
          showSource = !showSource;
          e.target.textContent = showSource ? 'Ver renderizado' : 'Ver código';
          paint();
        });
        await paint();
        break;
      }
      case 'text':
        body.innerHTML = await textBody(entry, urlPath);
        break;
      default:
        body.innerHTML = `<div class="pv-empty">
          <img src="${iconFor(entry)}" alt="" />
          <p>Sin vista previa para este tipo de archivo.</p>
          <p class="pv-note">Usa el botón de descarga o el clic derecho.</p>
        </div>`;
    }
  } catch (err) {
    body.innerHTML = `<p class="pv-note">No se pudo cargar la vista previa.</p>`;
  }
}

// Editor en línea para archivos de texto / código / markdown.
async function enterEditMode(container, entry, urlPath) {
  const body = container.querySelector('#pvBody');
  if (!body) return;
  body.innerHTML = '<p class="pv-note">Cargando…</p>';

  let text = '', truncated = false;
  try {
    const res = await fetch(rawUrl(urlPath));
    truncated = res.headers.get('X-Truncated') === '1';
    text = await res.text();
  } catch {
    body.innerHTML = '<p class="pv-note">No se pudo cargar el archivo para editar.</p>';
    return;
  }

  body.innerHTML = `
    <div class="pv-editor">
      <div class="pv-edit-bar">
        <button class="btn btn-sm" data-save>Guardar</button>
        <button class="btn btn-sm" data-cancel>Cancelar</button>
        <span class="pv-edit-status"></span>
      </div>
      <textarea class="pv-textarea" spellcheck="false" wrap="off"></textarea>
    </div>`;

  const ta = body.querySelector('.pv-textarea');
  const status = body.querySelector('.pv-edit-status');
  const saveBtn = body.querySelector('[data-save]');
  ta.value = text;
  ta.focus();

  if (truncated) {
    saveBtn.disabled = true;
    status.textContent = 'Archivo demasiado grande para editar de forma segura';
  }

  const restore = () => renderPreview(container, entry, urlPath);

  const doSave = async () => {
    if (saveBtn.disabled) return;
    status.textContent = 'Guardando…';
    saveBtn.disabled = true;
    try {
      const res = await fetch(saveUrl(urlPath), { method: 'POST', body: ta.value });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar');
      entry.size = data.size;
      entry.mtime = data.mtime;
      status.textContent = 'Guardado ✓';
      setTimeout(restore, 650);
    } catch (e) {
      status.textContent = e.message;
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', doSave);
  body.querySelector('[data-cancel]').addEventListener('click', restore);
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      doSave();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
    }
  });
}

// El explorador pide editar el archivo previsualizado (desde el menú contextual).
document.addEventListener('explorer:edit', () => {
  if (current && isEditable(current.kind)) {
    enterEditMode(current.container, current.entry, current.urlPath);
  }
});
