// Inverse orthographic projection: a rectangular world map wrapped around a sphere.
export function spherePoint(x, y, tilt = .20) {
  const square = x * x + y * y;
  if (square > 1) return null;
  const z = Math.sqrt(1 - square), north = -y * Math.cos(tilt) + z * Math.sin(tilt);
  const depth = y * Math.sin(tilt) + z * Math.cos(tilt);
  return { u: .5 + Math.atan2(x, depth) / (2 * Math.PI), v: .5 - Math.asin(Math.max(-1, Math.min(1, north))) / Math.PI,
    light: .48 + .52 * Math.max(0, -x * .4 - y * .4 + z * .82) };
}

export function mountGlobe(button, labels) {
  const canvas = button.querySelector('canvas'), ctx = canvas.getContext('2d');
  const image = new Image(), motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, paused = motion.matches, visible = true, frame = 0, last = 0, angle = -.02, texture;
  const size = 320, width = 2048, height = 1024, samples = [], pixels = ctx.createImageData(size, size);
  canvas.width = canvas.height = size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = spherePoint((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2));
    if (p) samples.push([4 * (y * size + x), p.u, Math.min(height - 1, Math.floor(p.v * height)), p.light]);
  }
  const label = () => { button.setAttribute('aria-label', paused ? labels.play : labels.pause); button.setAttribute('aria-pressed', String(!paused)); };
  function draw() {
    if (!texture || disposed) return;
    for (const [at, u, y, light] of samples) {
      const x = Math.floor(((u + angle) % 1 + 1) % 1 * width), source = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) pixels.data[at + k] = texture[source + k] * light;
      pixels.data[at + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  function tick(now) {
    if (disposed || paused || !visible || document.hidden) { frame = 0; return; }
    if (now - last > 80) { angle += .0011; draw(); last = now; }
    frame = requestAnimationFrame(tick);
  }
  function resume() { if (!frame && texture && !paused && visible && !document.hidden && !disposed) frame = requestAnimationFrame(tick); }
  const click = () => { paused = !paused; label(); resume(); };
  const preference = () => { paused = motion.matches; label(); resume(); };
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); });
  observer.observe(button);
  button.addEventListener('click', click); motion.addEventListener('change', preference); document.addEventListener('visibilitychange', resume);
  image.onload = () => {
    if (disposed) return;
    const flat = document.createElement('canvas'); flat.width = width; flat.height = height;
    const flatCtx = flat.getContext('2d', {willReadFrequently:true}); flatCtx.drawImage(image, 0, 0, width, height);
    texture = flatCtx.getImageData(0, 0, width, height).data; draw(); resume();
  };
  image.src = new URL('./assets/world-map.svg', import.meta.url).href;
  label();
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); button.removeEventListener('click', click); motion.removeEventListener('change', preference); document.removeEventListener('visibilitychange', resume); };
}
