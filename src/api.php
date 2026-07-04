<?php
// API del explorador de archivos.
//   ?__api=list&path=/ruta/   -> JSON con las entradas de la carpeta
//   ?__api=raw&path=/x.txt    -> contenido crudo del archivo (para vista previa),
//                                sirviendo .php/.html como TEXTO (no los ejecuta)
//   ?__api=meta&path=/x.png   -> metadatos de un único archivo (JSON)
//
// Todo queda restringido al DOCUMENT_ROOT: no se puede leer fuera de htdocs.
declare(strict_types=1);

const PREVIEW_MAX_BYTES = 2 * 1024 * 1024; // límite de texto para la vista previa (2 MB)

require __DIR__ . '/config.php';           // ALLOW_EDIT, ALLOW_DELETE, ALLOW_COPY, ALLOW_MOVE

$docroot = realpath($_SERVER['DOCUMENT_ROOT']);
$action  = $_GET['__api'] ?? '';
$reqPath = $_GET['path']  ?? '/';

/** Resuelve una ruta pedida a una ruta real dentro del docroot, o false si escapa. */
function resolve_within_root(string $docroot, string $reqPath)
{
    $rel  = ltrim(urldecode($reqPath), '/');
    $full = realpath($docroot . '/' . $rel);
    if ($full === false) {
        return false;
    }
    // Debe ser el propio docroot o estar contenido en él.
    if ($full !== $docroot && strpos($full, $docroot . DIRECTORY_SEPARATOR) !== 0) {
        return false;
    }
    return $full;
}

/** ¿La carpeta contiene al menos una subcarpeta (ignorando ocultas)? Sale al primer hallazgo. */
function dir_has_subdir(string $path): bool
{
    $dh = @opendir($path);
    if ($dh === false) return false;
    $found = false;
    while (($f = readdir($dh)) !== false) {
        if ($f === '.' || $f === '..' || $f[0] === '.') continue;
        if (is_dir($path . '/' . $f)) { $found = true; break; }
    }
    closedir($dh);
    return $found;
}

/** Protege la raíz y la carpeta del propio explorador (/src) de borrado/movida. */
function is_protected(string $full, string $docroot): bool
{
    if ($full === $docroot) return true;
    $app = realpath($docroot . '/src');
    return $app !== false && ($full === $app || strpos($full, $app . DIRECTORY_SEPARATOR) === 0);
}

/** Borra recursivamente un archivo o carpeta. */
function rrmdir(string $path): bool
{
    if (is_file($path) || is_link($path)) return @unlink($path);
    if (!is_dir($path)) return false;
    foreach (scandir($path) as $e) {
        if ($e === '.' || $e === '..') continue;
        rrmdir($path . '/' . $e);
    }
    return @rmdir($path);
}

/** Copia recursivamente un archivo o carpeta. */
function rcopy(string $src, string $dst): bool
{
    if (is_dir($src)) {
        if (!@mkdir($dst, 0777, true) && !is_dir($dst)) return false;
        foreach (scandir($src) as $e) {
            if ($e === '.' || $e === '..') continue;
            if (!rcopy($src . '/' . $e, $dst . '/' . $e)) return false;
        }
        return true;
    }
    return @copy($src, $dst);
}

/** Resuelve la carpeta destino (debe existir y estar dentro de docroot). */
function resolve_dest_dir(string $docroot, string $destUrl)
{
    $dir = realpath($docroot . '/' . ltrim(urldecode($destUrl), '/'));
    if ($dir === false || !is_dir($dir)) return false;
    if ($dir !== $docroot && strpos($dir, $docroot . DIRECTORY_SEPARATOR) !== 0) return false;
    return $dir;
}

/**
 * Extrae un ZIP usando solo el núcleo de PHP (zlib), sin la extensión ext-zip.
 * Soporta los métodos "stored" (0) y "deflate" (8), que cubren casi todos los ZIP.
 */
function extract_zip_pure(string $file, string $dest): bool
{
    $data = @file_get_contents($file);
    if ($data === false) return false;

    $eocd = strrpos($data, "PK\x05\x06"); // fin del directorio central
    if ($eocd === false) return false;
    $count  = unpack('v', substr($data, $eocd + 10, 2))[1];
    $offset = unpack('V', substr($data, $eocd + 16, 4))[1];

    $p = $offset;
    for ($i = 0; $i < $count; $i++) {
        if (substr($data, $p, 4) !== "PK\x01\x02") break;    // cabecera de directorio central
        $method   = unpack('v', substr($data, $p + 10, 2))[1];
        $compSize = unpack('V', substr($data, $p + 20, 4))[1];
        $nameLen  = unpack('v', substr($data, $p + 28, 2))[1];
        $extraLen = unpack('v', substr($data, $p + 30, 2))[1];
        $commLen  = unpack('v', substr($data, $p + 32, 2))[1];
        $lho      = unpack('V', substr($data, $p + 42, 4))[1];
        $name     = substr($data, $p + 46, $nameLen);
        $p += 46 + $nameLen + $extraLen + $commLen;

        // protección contra zip-slip
        if ($name === '' || strpos($name, '..') !== false || $name[0] === '/' || $name[0] === '\\') continue;

        $out = $dest . '/' . $name;
        if (substr($name, -1) === '/') { @mkdir($out, 0777, true); continue; }
        @mkdir(dirname($out), 0777, true);

        if (substr($data, $lho, 4) !== "PK\x03\x04") continue; // cabecera local
        $lNameLen  = unpack('v', substr($data, $lho + 26, 2))[1];
        $lExtraLen = unpack('v', substr($data, $lho + 28, 2))[1];
        $raw = substr($data, $lho + 30 + $lNameLen + $lExtraLen, $compSize);

        if ($method === 0)     $content = $raw;              // sin comprimir
        elseif ($method === 8) $content = @gzinflate($raw);  // deflate (zlib del núcleo)
        else continue;                                       // método no soportado
        if ($content === false) continue;

        @file_put_contents($out, $content);
    }
    return true;
}

/** Extrae un comprimido en $dest usando solo el núcleo de PHP (zlib + Phar). */
function extract_archive(string $file, string $dest, string $ext): bool
{
    if ($ext === 'zip') return extract_zip_pure($file, $dest);

    // tar / tar.gz / tgz con PharData (incluido en PHP)
    $isTar = preg_match('/\.(tar|tgz)$/i', $file) || preg_match('/\.tar\.gz$/i', $file);
    if ($isTar && class_exists('PharData')) {
        try { (new PharData($file))->extractTo($dest, null, true); return true; }
        catch (Throwable $e) { return false; }
    }

    // .gz de un solo archivo
    if ($ext === 'gz' && function_exists('gzdecode')) {
        $raw = @file_get_contents($file);
        if ($raw === false) return false;
        $out = @gzdecode($raw);
        if ($out === false) return false;
        $name = preg_replace('/\.gz$/i', '', basename($file)) ?: 'archivo';
        return @file_put_contents($dest . '/' . $name, $out) !== false;
    }

    return false;
}

/** Valida un nombre de archivo/carpeta: sin barras, sin ".."/".", no vacío. */
function valid_name(string $name)
{
    $name = trim($name);
    if ($name === '' || $name === '.' || $name === '..') return false;
    if (strpbrk($name, "/\\\0") !== false) return false;
    return $name;
}

/** Devuelve una ruta destino que no exista, añadiendo " (2)", " (3)"… si hace falta. */
function unique_path(string $dir, string $name): string
{
    if (!file_exists($dir . '/' . $name)) return $dir . '/' . $name;
    $dot  = strrpos($name, '.');
    $base = ($dot !== false && $dot > 0) ? substr($name, 0, $dot) : $name;
    $ext  = ($dot !== false && $dot > 0) ? substr($name, $dot) : '';
    $i = 2;
    while (file_exists($dir . '/' . $base . ' (' . $i . ')' . $ext)) $i++;
    return $dir . '/' . $base . ' (' . $i . ')' . $ext;
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$full = resolve_within_root($docroot, $reqPath);
if ($full === false) {
    json_out(['error' => 'Ruta no encontrada o fuera del alcance'], 404);
}

// Entradas que se ocultan solo en la raíz (infraestructura del propio explorador).
$rootHidden = ['src', '.dev', '.git', '.github'];

switch ($action) {

    case 'list': {
        if (!is_dir($full)) {
            json_out(['error' => 'No es una carpeta'], 400);
        }
        $isRoot       = ($full === $docroot);
        $withChildren = isset($_GET['children']); // solo el árbol lo pide
        $entries      = [];

        foreach (scandir($full) as $name) {
            if ($name === '.' || $name === '..') continue;
            if ($name[0] === '.') continue;                       // ocultar dotfiles
            if ($isRoot && in_array($name, $rootHidden, true)) continue;

            $p     = $full . '/' . $name;
            $isDir = is_dir($p);
            $entry = [
                'name'  => $name,
                'isDir' => $isDir,
                'size'  => $isDir ? null : @filesize($p),
                'mtime' => @filemtime($p),
                'ext'   => $isDir ? '' : strtolower(pathinfo($name, PATHINFO_EXTENSION)),
            ];
            if ($isDir && $withChildren) {
                $entry['hasChildren'] = dir_has_subdir($p);
            }
            $entries[] = $entry;
        }

        json_out([
            'path'    => '/' . trim(str_replace($docroot, '', $full), '/') . ($full === $docroot ? '' : '/'),
            'entries' => $entries,
        ]);
    }

    case 'meta': {
        if (!is_file($full)) {
            json_out(['error' => 'No es un archivo'], 404);
        }
        json_out([
            'name'  => basename($full),
            'size'  => @filesize($full),
            'mtime' => @filemtime($full),
            'ext'   => strtolower(pathinfo($full, PATHINFO_EXTENSION)),
            'mime'  => function_exists('mime_content_type') ? @mime_content_type($full) : null,
        ]);
    }

    case 'raw': {
        if (!is_file($full)) {
            http_response_code(404);
            exit;
        }
        $size      = (int) @filesize($full);
        $truncated = $size > PREVIEW_MAX_BYTES;

        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-File-Size: ' . $size);
        header('X-Truncated: ' . ($truncated ? '1' : '0'));

        $toRead = $truncated ? PREVIEW_MAX_BYTES : $size;
        if ($toRead > 0) {                     // fread() con longitud 0 lanza ValueError en PHP 8
            $fh = fopen($full, 'rb');
            if ($fh === false) { http_response_code(500); exit; }
            echo fread($fh, $toRead);
            fclose($fh);
        }
        exit;
    }

    case 'save': {
        if (!ALLOW_EDIT) {
            json_out(['error' => 'La edición está desactivada'], 403);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            json_out(['error' => 'Método no permitido'], 405);
        }
        if (!is_file($full)) {
            json_out(['error' => 'El archivo no existe'], 404);
        }
        $content = file_get_contents('php://input');
        if ($content === false) {
            json_out(['error' => 'No se recibió contenido'], 400);
        }
        if (strlen($content) > PREVIEW_MAX_BYTES) {
            json_out(['error' => 'El contenido supera el límite permitido'], 413);
        }
        if (@file_put_contents($full, $content) === false) {
            json_out(['error' => 'No se pudo escribir el archivo (¿permisos?)'], 500);
        }
        clearstatcache();
        json_out(['ok' => true, 'size' => @filesize($full), 'mtime' => @filemtime($full)]);
    }

    case 'delete': {
        if (!ALLOW_DELETE) json_out(['error' => 'Eliminar está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (is_protected($full, $docroot)) json_out(['error' => 'Este elemento está protegido'], 403);
        if (!file_exists($full)) json_out(['error' => 'No existe'], 404);
        if (!rrmdir($full)) json_out(['error' => 'No se pudo eliminar (¿permisos?)'], 500);
        json_out(['ok' => true]);
    }

    case 'copy':
    case 'move': {
        $isMove = ($action === 'move');
        if ($isMove && !ALLOW_MOVE) json_out(['error' => 'Mover está desactivado'], 403);
        if (!$isMove && !ALLOW_COPY) json_out(['error' => 'Copiar está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (!file_exists($full)) json_out(['error' => 'El origen no existe'], 404);
        if ($isMove && is_protected($full, $docroot)) json_out(['error' => 'Este elemento está protegido'], 403);

        $destDir = resolve_dest_dir($docroot, $_GET['dest'] ?? '');
        if ($destDir === false) json_out(['error' => 'Destino no válido'], 400);

        // Mover a la misma carpeta = sin cambios.
        if ($isMove && dirname($full) === $destDir) {
            json_out(['ok' => true, 'name' => basename($full)]);
        }
        // No permitir mover/copiar una carpeta dentro de sí misma.
        if (is_dir($full) && strpos($destDir . DIRECTORY_SEPARATOR, rtrim($full, '/') . DIRECTORY_SEPARATOR) === 0) {
            json_out(['error' => 'No puedes mover una carpeta dentro de sí misma'], 400);
        }

        $target = unique_path($destDir, basename($full));
        $ok = $isMove ? @rename($full, $target) : rcopy($full, $target);
        if (!$ok) json_out(['error' => 'No se pudo completar la operación'], 500);
        json_out(['ok' => true, 'name' => basename($target)]);
    }

    case 'mkfile':
    case 'mkdir': {
        if (!ALLOW_CREATE) json_out(['error' => 'Crear está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (!is_dir($full)) json_out(['error' => 'Carpeta destino no válida'], 400);

        $name = valid_name($_GET['name'] ?? '');
        if ($name === false) json_out(['error' => 'Nombre no válido'], 400);
        if (file_exists($full . '/' . $name)) json_out(['error' => 'Ya existe un elemento con ese nombre'], 409);

        $target = $full . '/' . $name;
        $ok = ($action === 'mkdir') ? @mkdir($target, 0777) : (@file_put_contents($target, '') !== false);
        if (!$ok) json_out(['error' => 'No se pudo crear (¿permisos?)'], 500);
        json_out(['ok' => true, 'name' => $name]);
    }

    case 'rename': {
        if (!ALLOW_RENAME) json_out(['error' => 'Renombrar está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (!file_exists($full)) json_out(['error' => 'No existe'], 404);
        if (is_protected($full, $docroot)) json_out(['error' => 'Este elemento está protegido'], 403);

        $name = valid_name($_GET['name'] ?? '');
        if ($name === false) json_out(['error' => 'Nombre no válido'], 400);

        $target = dirname($full) . '/' . $name;
        if ($target === $full) json_out(['ok' => true, 'name' => $name]); // sin cambios
        if (file_exists($target)) json_out(['error' => 'Ya existe un elemento con ese nombre'], 409);
        if (!@rename($full, $target)) json_out(['error' => 'No se pudo renombrar (¿permisos?)'], 500);
        json_out(['ok' => true, 'name' => $name]);
    }

    case 'upload': {
        if (!ALLOW_UPLOAD) json_out(['error' => 'Subir está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (!is_dir($full)) json_out(['error' => 'Carpeta destino no válida'], 400);
        if (!isset($_FILES['file'])) json_out(['error' => 'No se recibió ningún archivo'], 400);

        $f = $_FILES['file'];
        if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            json_out(['error' => 'Error al subir (código ' . $f['error'] . ')'], 400);
        }
        $name = valid_name(basename($f['name']));
        if ($name === false) json_out(['error' => 'Nombre no válido'], 400);

        $target = unique_path($full, $name);
        if (!@move_uploaded_file($f['tmp_name'], $target)) {
            json_out(['error' => 'No se pudo guardar el archivo'], 500);
        }
        json_out(['ok' => true, 'name' => basename($target)]);
    }

    case 'extract': {
        if (!ALLOW_EXTRACT) json_out(['error' => 'Extraer está desactivado'], 403);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_out(['error' => 'Método no permitido'], 405);
        if (!is_file($full)) json_out(['error' => 'El archivo no existe'], 404);

        // Carpeta destino nueva junto al comprimido (sin sobrescribir).
        $base = pathinfo($full, PATHINFO_FILENAME);
        if (preg_match('/\.tar$/i', $base)) $base = substr($base, 0, -4); // x.tar.gz -> x
        $dest = unique_path(dirname($full), $base !== '' ? $base : 'extraido');
        if (!@mkdir($dest, 0777)) json_out(['error' => 'No se pudo crear la carpeta destino'], 500);

        $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
        if (!extract_archive($full, $dest, $ext)) {
            rrmdir($dest);
            json_out(['error' => 'Formato no soportado o error al extraer'], 500);
        }
        json_out(['ok' => true, 'name' => basename($dest)]);
    }

    default:
        json_out(['error' => 'Acción desconocida'], 400);
}
