// Resaltador de sintaxis minimalista y sin dependencias.
// No pretende ser perfecto: colorea comentarios, cadenas, números, palabras
// clave, etiquetas y atributos, suficiente para una vista previa legible.

export function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

const KEYWORDS = new Set((
  'abstract as async await break case catch class const continue default def delete do ' +
  'else elif enum export extends false final finally fn for from func function if implements ' +
  'import in instanceof interface is let namespace new null None object of package private ' +
  'protected public return self static super switch this throw True true try typeof var void ' +
  'while with yield echo print public function use require require_once include include_once ' +
  'foreach endforeach endif endwhile match struct impl pub mod trait where lambda pass raise except'
).split(' '));

// Tokenizador para lenguajes tipo C / JS / PHP / Python / etc.
function highlightCode(code) {
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b0[xXbo][0-9a-fA-F_]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$@][\w$]*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) out += `<span class="tok-com">${escapeHtml(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${escapeHtml(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-num">${escapeHtml(m[3])}</span>`;
    else if (m[4]) {
      const w = m[4];
      out += KEYWORDS.has(w)
        ? `<span class="tok-key">${escapeHtml(w)}</span>`
        : escapeHtml(w);
    }
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

// Markup (HTML/XML/SVG): comentarios, etiquetas, atributos y cadenas.
function highlightMarkup(code) {
  const re = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*)|([a-zA-Z-]+)(=)("(?:[^"]*)"|'(?:[^']*)')|(\/?>)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) out += `<span class="tok-com">${escapeHtml(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-tag">${escapeHtml(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-attr">${escapeHtml(m[3])}</span>${escapeHtml(m[4])}<span class="tok-str">${escapeHtml(m[5])}</span>`;
    else if (m[6]) out += `<span class="tok-tag">${escapeHtml(m[6])}</span>`;
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

// CSS: comentarios, cadenas, at-rules, colores hex, números con unidad.
function highlightCss(code) {
  const re = /(\/\*[\s\S]*?\*\/)|("(?:[^"]*)"|'(?:[^']*)')|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr|pt)?\b)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) out += `<span class="tok-com">${escapeHtml(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${escapeHtml(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-key">${escapeHtml(m[3])}</span>`;
    else if (m[4]) out += `<span class="tok-num">${escapeHtml(m[4])}</span>`;
    else if (m[5]) out += `<span class="tok-num">${escapeHtml(m[5])}</span>`;
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

// JSON: claves, cadenas, números, booleanos/null.
function highlightJson(code) {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) {
      const cls = m[2] ? 'tok-attr' : 'tok-str';
      out += `<span class="${cls}">${escapeHtml(m[1])}</span>${m[2] ? escapeHtml(m[2]) : ''}`;
    } else if (m[3]) out += `<span class="tok-num">${escapeHtml(m[3])}</span>`;
    else if (m[4]) out += `<span class="tok-key">${escapeHtml(m[4])}</span>`;
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

export function highlight(code, lang) {
  switch (lang) {
    case 'markup': return highlightMarkup(code);
    case 'css': return highlightCss(code);
    case 'json': return highlightJson(code);
    default: return highlightCode(code);
  }
}
