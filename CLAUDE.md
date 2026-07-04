# CLAUDE.md

Guidance for working in this repository.

## What this is

**htdocs-explorer** replaces the ugly default Apache/PHP directory listing with a
modern, browser-based **file explorer** (Windows-Explorer style): tree sidebar,
multiple views, live preview pane, inline editing, and full file management
(create / rename / delete / copy / move / upload / extract).

It is dropped into a web server's document root. Every folder that has **no**
`index.php`/`index.html` is served with the explorer; folders that *do* have an
index are left alone (so real projects keep working). This is wired in `.htaccess`
via `mod_rewrite`.

## Hard constraints (please respect)

- **Vanilla, no build step.** The frontend is plain ES modules + CSS. No bundler,
  no `node_modules`, no framework. Anyone can clone and drop it into `htdocs`.
- **No external dependencies.** The backend uses only PHP core. Archive extraction
  is done with core `zlib` (a hand-written pure-PHP ZIP reader) and `PharData`
  (tar/gz) — **no `ext-zip`, no `7z` binary, no Composer packages.**
- **Match the existing style** (Spanish UI strings, 2-space indent, the small
  helper conventions already in the JS).

## Run it (no XAMPP needed)

A throwaway Docker env lives in `.dev/` (Apache + PHP with `mod_rewrite`, nothing else):

```bash
cd .dev
docker compose up          # → http://localhost:8080
docker compose down        # tears it down, nothing installed on the host
```

The container mounts the repo as `htdocs`, so edits to `src/` are live on reload.
A sample `demo/` folder (with a `proyecto-ejemplo.zip` to try extraction) is included.

> **Heads up:** browsers cache the ES modules aggressively. After editing files in
> `src/`, do a hard refresh (**Ctrl+Shift+R**) to see changes.

## Architecture

```
.htaccess          mod_rewrite: index-less dirs → src/app.php; upload size limits
src/config.php     feature flags (the ONLY place to toggle write "powers")
src/api.php        JSON/raw/action API — all filesystem work, sandboxed to docroot
src/app.php        HTML shell served for every directory; exposes flags via data-caps
src/*.js           ES modules (no build):
  explorer.js        controller: state, views, selection, keyboard, DnD, ops, menus
  preview.js         preview pane (image/video/audio/pdf/code/markdown) + inline editor
  tree.js            lazy folder tree (caret only when a dir has subdirs)
  icons.js           extension/folder-name → icon mapping (reuses src/icons/*.svg)
  format.js          humanSize / dates / kind detection
  highlight.js       tiny dependency-free syntax highlighter
  markdown.js        tiny markdown renderer
  lightbox.js        fullscreen image viewer for gallery mode
src/app.css        all styles (light/dark via [data-theme] + prefers-color-scheme)
src/icons/         Material-Icon-Theme SVGs
demo/              sample content for trying the explorer
.dev/              Docker dev environment (Dockerfile, compose, Apache override)
```

### API (`src/api.php`, `?__api=<action>`)

Read: `list` (dir → JSON; `&children=1` adds `hasChildren` for the tree),
`raw` (file bytes as text, so `.php` shows source), `meta`.
Write (all POST, all gated by a flag): `save`, `delete`, `copy`, `move`, `mkfile`,
`mkdir`, `rename`, `upload` (multipart), `extract`.

Every path is resolved with `realpath` and must stay inside `DOCUMENT_ROOT`.
`/src` (the app itself) and the docroot are protected from delete/rename/move.

## Feature flags — `src/config.php`

All write capabilities are booleans here: `ALLOW_EDIT`, `ALLOW_DELETE`, `ALLOW_COPY`,
`ALLOW_MOVE`, `ALLOW_CREATE`, `ALLOW_RENAME`, `ALLOW_UPLOAD`, `ALLOW_EXTRACT`.
`app.php` turns the active ones into `<body data-caps="…">`; the JS reads that and
**hides the corresponding UI** when a flag is off. Set any to `false` for read-only.

## Conventions & gotchas

- File actions live in a **right-click context menu** (not button rows). The preview
  header only keeps a download icon; markdown keeps its "Ver código" toggle.
- The clipboard for copy/cut is **in-memory only** (not persisted) so the "Pegar"
  button disappears on reload.
- Use the `hidden` attribute to hide elements — a global `[hidden]{display:none!important}`
  rule exists because `.btn`/`.preview` set `display`, which would otherwise win.
- When testing in the browser, a long-lived automation tab can freeze
  (`document_idle` hangs); it's environmental — open a fresh tab to recover.

## Verifying changes

Prefer driving the real app in the Docker env over assumptions. Backend actions are
easy to check with `curl` against `/src/api.php?__api=…`; UI behavior should be
checked in the browser after a hard refresh.
