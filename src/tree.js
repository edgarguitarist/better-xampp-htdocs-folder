// Árbol de carpetas lateral, con carga perezosa de subcarpetas.
import { iconFor } from './icons.js';

const listUrl = (path) => '/src/api.php?__api=list&children=1&path=' + encodeURIComponent(path);

async function fetchDirs(path) {
  try {
    const res = await fetch(listUrl(path));
    const data = await res.json();
    return (data.entries || []).filter((e) => e.isDir);
  } catch { return []; }
}

const caretSvg = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 6l6 6-6 6"/></svg>';

export function initTree(container, { onNavigate, initialPath }) {
  const byPath = new Map();

  function makeNode(name, path, depth, { isRoot = false, hasChildren = true } = {}) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = (6 + depth * 14) + 'px';
    row.dataset.path = path;

    const caret = document.createElement('span');
    caret.className = 'tree-caret';
    caret.innerHTML = caretSvg;

    const icon = document.createElement('img');
    icon.className = 'tree-icon';
    icon.src = isRoot ? '/src/icons/folder-base.svg' : iconFor({ isDir: true, name });

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = isRoot ? 'Inicio' : name;

    row.append(caret, icon, label);

    const children = document.createElement('div');
    children.className = 'tree-children';
    children.hidden = true;

    node.append(row, children);

    const st = { path, depth, loaded: false, expanded: false, children, caret, row };
    byPath.set(path, st);

    // Sin subcarpetas: nada que cargar y se oculta la flechita (clase .leaf).
    if (!isRoot && hasChildren === false) { st.loaded = true; row.classList.add('leaf'); }

    caret.addEventListener('click', (e) => { e.stopPropagation(); toggle(st); });
    row.addEventListener('click', () => onNavigate(path));
    return node;
  }

  async function loadChildren(st) {
    if (st.loaded) return;
    const dirs = await fetchDirs(st.path);
    st.children.innerHTML = '';
    st.row.classList.toggle('leaf', dirs.length === 0);
    for (const d of dirs) {
      const childPath = st.path + encodeURIComponent(d.name) + '/';
      st.children.append(makeNode(d.name, childPath, st.depth + 1, { hasChildren: !!d.hasChildren }));
    }
    st.loaded = true;
  }

  function expand(st, on) {
    st.expanded = on;
    st.children.hidden = !on;
    st.row.classList.toggle('expanded', on);
  }

  async function toggle(st) {
    if (!st.expanded) { await loadChildren(st); expand(st, true); }
    else expand(st, false);
  }

  async function setActive(path) {
    container.querySelectorAll('.tree-row.active').forEach((r) => r.classList.remove('active'));
    // expande la cadena de ancestros hasta la ruta actual
    const parts = path.split('/').filter(Boolean);
    let acc = '/';
    let st = byPath.get('/');
    if (st) { await loadChildren(st); expand(st, true); }
    for (const p of parts) {
      acc += p + '/';
      st = byPath.get(acc);
      if (!st) break;
      if (acc !== path) { await loadChildren(st); expand(st, true); }
    }
    const target = byPath.get(path);
    if (target) {
      target.row.classList.add('active');
      target.row.scrollIntoView({ block: 'nearest' });
    }
  }

  // Recarga los hijos de un nodo ya cargado (tras crear/borrar/mover carpetas).
  async function reload(path) {
    const st = byPath.get(path);
    if (!st || !st.loaded) return;
    const wasExpanded = st.expanded;
    st.loaded = false;
    await loadChildren(st);
    expand(st, wasExpanded);
  }

  // raíz
  container.innerHTML = '';
  container.append(makeNode('', '/', 0, { isRoot: true }));
  const rootState = byPath.get('/');
  loadChildren(rootState).then(() => { expand(rootState, true); setActive(initialPath); });

  return { setActive, reload };
}
