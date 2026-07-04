# Entorno de desarrollo (sin XAMPP) 🐳

Este proyecto es una personalización del **autoindex de Apache** (`mod_autoindex` +
`FancyIndexing` + PHP). Para probarlo no hace falta instalar XAMPP: basta un
Apache + PHP, que es justo lo que levanta este contenedor Docker desechable.
No usa MySQL, así que XAMPP entero era innecesario.

## Requisitos

- Docker Desktop (ya lo tienes instalado).

## Uso

```bash
cd .dev
docker compose up        # levanta Apache + PHP en http://localhost:8080
```

Abre <http://localhost:8080> — verás el listado con tu estilo, iconos,
breadcrumb, buscador, dark mode y grid, igual que en XAMPP.

La carpeta `demo/` (en la raíz del repo) trae archivos y subcarpetas de ejemplo
para ver los iconos, el grid y el breadcrumb anidado en acción.

Para apagarlo (no deja rastro en tu PC):

```bash
docker compose down
```

Como el repo se monta como volumen, cualquier cambio que hagas en `src/`,
`.htaccess`, iconos, etc. se refleja al recargar el navegador. Solo si tocas el
`.htaccess` puede hacer falta un `Ctrl+F5`.

## Nota técnica: por qué existe `allow-override.conf`

La imagen `php:apache` necesita dos cosas que XAMPP ya trae de fábrica:

1. **`AllowOverride All`** — para que Apache lea tu `.htaccess`.
2. **`AddType text/html .php`** — para que `mod_autoindex` ejecute el
   `HeaderName /src/header.php` (el breadcrumb + buscador). `mod_autoindex` solo
   procesa el header como PHP si su content-type en el *lookup* es `text/html`;
   por defecto la imagen lo marca como `application/x-httpd-php` y lo descartaba.
   PHP se sigue ejecutando por el `SetHandler` de la imagen, así que servir `.php`
   normal no se ve afectado.

Ambas van en `allow-override.conf`, que se monta dentro del contenedor. No
modifica tu proyecto.
