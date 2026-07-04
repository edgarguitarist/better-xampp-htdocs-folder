# htdocs-explorer

The default directory listing of an Apache/PHP server (the classic XAMPP `htdocs` page, a LAMP box, cheap shared hosting…) is outdated and ugly. **This replaces it with a modern file explorer** — think Windows Explorer in your browser: a clean listing, a live preview pane, keyboard navigation and instant search. 🚀

Just drop it into your web root (`htdocs`, `www`, `public_html`…) and browse to `http://localhost`. Every folder that doesn't have its own `index` file is served with the explorer automatically, so you can walk through any project without losing the nice UI.

![htdocs-explorer in dark mode — file explorer with a live video preview](screenshots/dark-media-preview.png)

![htdocs-explorer in light mode — gallery view](screenshots/light-gallery.png)

## Features ✨

- **📂 File explorer** with four views: list, grid (with image thumbnails), details (sortable by name, size and date) and a **gallery** mode.
- **🌳 Folder tree sidebar** — lazy-loaded, auto-expands to your current path, one click to jump anywhere.
- **⚡ SPA navigation** — moving between folders never reloads the page (History API), so it feels like a desktop app. Deep links and back/forward still work.
- **👁️ Preview pane** — select a file and preview it inline:
  - Images, video and audio players
  - PDFs
  - Source code with **syntax highlighting** and line numbers (`.php`/`.html` are shown as *source*, not executed)
  - **Markdown** rendered on the fly
- **✏️ Inline editing** — edit text / code / Markdown files right in the preview pane and save (`Ctrl`/`Cmd`+`S`).
- **🗂️ File management** — a **right-click context menu** (open, download, edit, rename, copy path, copy / cut / paste, delete) on any file or multi-selection, plus **new file / new folder** (the `＋` button or right-clicking empty space). Delete asks for confirmation; keyboard shortcuts too (`Ctrl`/`Cmd`+`C` / `X` / `V`, `Delete`, `F2` to rename). Every "power" is a flag in [`src/config.php`](src/config.php) (`ALLOW_EDIT`, `ALLOW_DELETE`, `ALLOW_COPY`, `ALLOW_MOVE`, `ALLOW_CREATE`, `ALLOW_RENAME`, `ALLOW_UPLOAD`, `ALLOW_EXTRACT`) — turn any off to lock the explorer down; its controls disappear from the UI. The app's own `/src` folder and the docroot are protected.
- **⬆️ Upload** — the `＋` menu (or **drag-and-drop** files straight onto the file pane) uploads into the current folder.
- **🗜️ Extract archives** — right-click a `.zip` / `.tar` / `.tar.gz` / `.gz` and "Extract here". **No external dependencies**: ZIP is unpacked in pure PHP using core `zlib` (`gzinflate`), and tar/tar.gz via the bundled `Phar`/`PharData` — so it works on a stock PHP install (no `ext-zip`, no `7z` binary).
- **🖼️ Gallery + lightbox** — browse image-heavy folders as big tiles and open a full-screen viewer with prev/next (arrow keys).
- **☑️ Multi-selection** — `Ctrl`/`Cmd`+click to toggle, `Shift`+click for ranges, `Ctrl`+`A` to select all; batch **copy paths** / **download**.
- **⌨️ Keyboard navigation** — arrow keys to move, `Enter` to open, `Backspace` to go up, `Esc` to clear, `Shift`+arrows to extend selection. Start typing to jump to search.
- **✨ Explorer-style niceties** — hover tooltips with file details, click-drag **rubber-band selection**, cut items dim / copied items get a dashed outline, and a loading overlay while archives extract or files upload.
- **🔎 Instant search** — filter the current folder as you type (no more exact-name-and-extension matching).
- **🍞 Breadcrumb** navigation and an "up" button.
- **🌙 Dark / light theme** that remembers your choice, plus togglable tree and preview panes.
- **🎨 Rich icons** by file type and folder name, reusing [Material Icon Theme] assets.

## Installation ⚙️

1. Copy the `src/` folder and the `.htaccess` file into the root of your XAMPP `htdocs`.
2. Make sure Apache has `mod_rewrite` enabled and `AllowOverride All` for `htdocs` (XAMPP ships this way by default).
3. Open `http://localhost/` — that's it. Create a folder per project as usual and browse away.

> Folders that contain their own `index.php` / `index.html` are left untouched, so your projects run normally.

## Try it without installing XAMPP 🐳

Don't want to install XAMPP just to hack on this? There's a throwaway Docker dev environment (Apache + PHP, no MySQL) under [`.dev/`](.dev/):

```bash
cd .dev
docker compose up     # → http://localhost:8080
```

`docker compose down` when you're done — nothing is installed on your machine. See [`.dev/README.md`](.dev/README.md) for details. A sample [`demo/`](demo/) folder is included to show off the previews.

## How it works 🧠

The previous version hooked into Apache's `mod_autoindex` (fragile, limited). This version is a small, **zero-build** app:

- **`.htaccess`** rewrites any index-less directory to `src/app.php`.
- **`src/api.php`** scans the folder (JSON) and streams raw file contents for previews — everything sandboxed inside `htdocs`.
- **`src/*.js`** are plain ES modules (no bundler, no `node_modules`): the explorer, preview, icon mapping, a tiny Markdown renderer and a lightweight syntax highlighter.

## Contributing 🤝

PRs welcome! The Docker env above makes it a one-command setup. Ideas: a command palette (`Ctrl`+`K`), breadcrumb drop-downs, archive contents preview, office-doc previews, upload progress bars, or per-folder settings.

[Material Icon Theme]: https://github.com/PKief/vscode-material-icon-theme
