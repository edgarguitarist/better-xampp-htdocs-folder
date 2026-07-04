// Visor de imágenes a pantalla completa (lightbox) para el modo galería.

export function openLightbox(images, startIndex) {
  if (!images.length) return;
  let i = startIndex;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `
    <button class="lb-btn lb-close" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
    <button class="lb-btn lb-prev" title="Anterior (←)" aria-label="Anterior">‹</button>
    <figure class="lb-figure">
      <img class="lb-img" alt="" />
      <figcaption class="lb-cap"></figcaption>
    </figure>
    <button class="lb-btn lb-next" title="Siguiente (→)" aria-label="Siguiente">›</button>`;
  document.body.append(overlay);

  const img = overlay.querySelector('.lb-img');
  const cap = overlay.querySelector('.lb-cap');

  const show = () => {
    i = (i % images.length + images.length) % images.length;
    img.src = images[i].url;
    cap.textContent = `${images[i].name} · ${i + 1}/${images.length}`;
  };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') { i++; show(); }
    else if (e.key === 'ArrowLeft') { i--; show(); }
  };

  overlay.querySelector('.lb-close').onclick = close;
  overlay.querySelector('.lb-prev').onclick = () => { i--; show(); };
  overlay.querySelector('.lb-next').onclick = () => { i++; show(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  show();
}
