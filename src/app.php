<?php
// Shell del explorador. Apache lo sirve para cualquier carpeta sin index propio
// (ver .htaccess). La ruta actual se toma de la URL; el resto lo hace el JS.
require __DIR__ . '/config.php';

$path = $_SERVER['REQUEST_URI'] ?? '/';
$path = strtok($path, '?'); // quita query string
$name = trim($path, '/');
$name = $name === '' ? 'Inicio' : basename($name);

// Capacidades activas -> se exponen al JS para mostrar/ocultar acciones.
$caps = array_keys(array_filter([
    'edit'   => ALLOW_EDIT,
    'delete' => ALLOW_DELETE,
    'copy'   => ALLOW_COPY,
    'move'   => ALLOW_MOVE,
    'create' => ALLOW_CREATE,
    'rename' => ALLOW_RENAME,
    'upload' => ALLOW_UPLOAD,
    'extract' => ALLOW_EXTRACT,
]));

// Firma del servidor, como la que Apache muestra por defecto en sus listados.
$serverSig = ($_SERVER['SERVER_SOFTWARE'] ?? 'Apache')
    . ' Server at ' . ($_SERVER['SERVER_NAME'] ?? 'localhost')
    . ' Port ' . ($_SERVER['SERVER_PORT'] ?? '80');
?><!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><?= htmlspecialchars($name) ?> · Explorador</title>
  <link rel="icon" type="image/svg+xml" href="/src/icons/folder-base.svg" />
  <link rel="stylesheet" href="/src/app.css" />
</head>
<body data-path="<?= htmlspecialchars($path, ENT_QUOTES) ?>" data-caps="<?= htmlspecialchars(implode(',', $caps), ENT_QUOTES) ?>">

  <header class="topbar">
    <div class="topbar-row">
      <button class="icon-btn" id="btnUp" title="Subir un nivel (Backspace)" aria-label="Subir">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83M5 20h14v-2H5z"/></svg>
      </button>
      <nav class="breadcrumb" id="breadcrumb" aria-label="Ruta"></nav>
      <button class="icon-btn" id="btnNew" title="Nuevo archivo o carpeta" aria-label="Nuevo" hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M13 11V5h-2v6H5v2h6v6h2v-6h6v-2z"/></svg>
      </button>
      <button class="btn btn-paste" id="btnPaste" title="Pegar aquí (Ctrl+V)" hidden>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7 18H5V4h2v3h10V4h2z"/></svg>
        <span id="pasteLabel">Pegar</span>
      </button>
    </div>

    <div class="topbar-row">
      <div class="search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14"/></svg>
        <input id="search" type="search" placeholder="Filtrar en esta carpeta…" autocomplete="off" spellcheck="false" />
      </div>

      <div class="view-toggle" role="group" aria-label="Vista">
        <button class="icon-btn" data-view="list" title="Lista" aria-label="Lista">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z"/></svg>
        </button>
        <button class="icon-btn" data-view="grid" title="Cuadrícula" aria-label="Cuadrícula">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 11h5V5H4zm0 8h5v-6H4zm6 0h5v-6h-5zm6 0h5v-6h-5zm-6-8h5V5h-5zm6-6v6h5V5z"/></svg>
        </button>
        <button class="icon-btn" data-view="details" title="Detalles" aria-label="Detalles">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 5h2v2H3zm0 6h2v2H3zm0 6h2v2H3zM7 5h14v2H7zm0 6h14v2H7zm0 6h14v2H7z"/></svg>
        </button>
        <button class="icon-btn" data-view="gallery" title="Galería" aria-label="Galería">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 3H3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1M8 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4m-4 11 5-6 3 3.5L15 12l5 7z"/></svg>
        </button>
      </div>

      <button class="icon-btn" id="btnTree" title="Árbol de carpetas" aria-label="Árbol de carpetas">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 3h8v6H3zm10 12h8v6h-8zm0-12h8v6h-8zM7 9v11h6v-2H9V9z"/></svg>
      </button>

      <button class="icon-btn" id="btnPreview" title="Panel de vista previa" aria-label="Vista previa">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10m0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/></svg>
      </button>

      <button class="icon-btn" id="btnTheme" title="Tema claro / oscuro" aria-label="Tema"></button>
    </div>
  </header>

  <main class="workspace" id="workspace">
    <aside class="tree-pane" id="tree" aria-label="Carpetas"></aside>
    <div class="resizer" data-resize="tree" role="separator" aria-label="Redimensionar árbol"></div>

    <section class="filepane" id="filepane" tabindex="0" aria-label="Archivos">
      <div class="listing" id="listing"></div>
      <div class="empty" id="empty" hidden></div>
    </section>

    <div class="resizer" data-resize="preview" role="separator" aria-label="Redimensionar vista previa"></div>
    <aside class="preview" id="preview" aria-label="Vista previa" hidden>
      <div class="preview-inner" id="previewInner"></div>
    </aside>
  </main>

  <footer class="statusbar">
    <span id="statusbar"></span>
    <span class="footer-meta">
      <span class="server-sig"><?= htmlspecialchars($serverSig) ?></span>
      <span class="credit">Developed with <span class="heart">❤️</span> by
        <a href="https://github.com/edgarguitarist" target="_blank" rel="noopener">edgarguitarist</a>
      </span>
    </span>
  </footer>

  <script type="module" src="/src/explorer.js"></script>
</body>
</html>
