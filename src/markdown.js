// Renderizador de Markdown minimalista (headings, listas, código, citas,
// enlaces, imágenes, negrita/cursiva). Suficiente para previsualizar READMEs.
import { escapeHtml, highlight } from './highlight.js';

const SENT = ''; // centinela (zona de uso privado) para proteger código en línea

function inline(text) {
  // Se escapa primero y luego se aplican patrones sobre el texto ya escapado.
  let t = escapeHtml(text);
  // código en línea (protege su contenido de otros patrones)
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => SENT + (codes.push('<code>' + c + '</code>') - 1) + SENT);
  // imágenes
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt, src) =>
    `<img src="${src}" alt="${alt}" loading="lazy" />`);
  // enlaces
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, txt, href) =>
    `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`);
  // negrita, cursiva, tachado
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // restaura código en línea
  t = t.replace(new RegExp(SENT + '(\\d+)' + SENT, 'g'), (_, i) => codes[+i]);
  return t;
}

export function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let html = '', i = 0;

  const flushList = (buf, ordered) => {
    if (!buf.length) return '';
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${buf.map((li) => `<li>${inline(li)}</li>`).join('')}</${tag}>`;
  };

  while (i < lines.length) {
    const line = lines[i];

    // bloque de código ```
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang = fence[1] || 'code';
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; // cierre
      const map = { js: 'code', ts: 'code', php: 'code', py: 'code', html: 'markup', xml: 'markup', css: 'css', json: 'json' };
      html += `<pre class="md-code"><code>${highlight(code.join('\n'), map[lang] || 'code')}</code></pre>`;
      continue;
    }

    // encabezados
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; i++; continue; }

    // línea horizontal
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { html += '<hr />'; i++; continue; }

    // cita
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${inline(quote.join(' '))}</blockquote>`;
      continue;
    }

    // listas
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      html += flushList(buf, false);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      html += flushList(buf, true);
      continue;
    }

    // línea en blanco
    if (/^\s*$/.test(line)) { i++; continue; }

    // párrafo (agrupa líneas consecutivas)
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|>\s?|```|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    html += `<p>${inline(para.join(' '))}</p>`;
  }

  return html;
}
