<?php
// Permisos de escritura del explorador.
// Cambia cualquiera a false para retirar ese "poder" (el botón desaparece de la UI
// y el endpoint responde 403). Por defecto, en local, todos activados.
const ALLOW_EDIT   = true;  // ✏️  editar el contenido de archivos de texto
const ALLOW_DELETE = true;  // 🗑️  eliminar archivos y carpetas
const ALLOW_COPY   = true;  // 📄  copiar (duplicar) a otra carpeta
const ALLOW_MOVE   = true;  // ✂️  mover / cortar a otra carpeta
const ALLOW_CREATE = true;  // ➕  crear archivos y carpetas nuevos
const ALLOW_RENAME = true;  // 🔤  renombrar archivos y carpetas
const ALLOW_UPLOAD = true;  // ⬆️  subir archivos (botón y arrastrar-soltar)
const ALLOW_EXTRACT = true; // 🗜️  extraer comprimidos (zip, tar, tar.gz, gz — solo núcleo de PHP)
