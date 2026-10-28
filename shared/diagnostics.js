// Ошибки воспроизведения уходят автору сайта в ntfy.sh сами, чтобы понять, у кого и почему не играет.
// Лента та же, что у жалоб «Полсекунды»: https://ntfy.sh/potenceval-halfsec-reports-b28430b1bd8c
const TOPIC = 'potenceval-halfsec-reports-b28430b1bd8c';
const sent = new Set();

export function reportPlaybackError(game, track, message) {
  const key = `${game}:${track?.id}:${message}`;
  if (!track?.id || sent.has(key)) return; // одна ошибка на трек за визит
  sent.add(key);
  const net = navigator.connection?.effectiveType || '?';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
  const device = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'телефон' : 'компьютер';
  const browser = navigator.userAgent.match(/(YaBrowser|Edg|OPR|Firefox|CriOS|Chrome|Version)\/[\d.]+/)?.[0] || navigator.userAgent.slice(0, 60);
  const body = `${message}\n${track.artist || ''} — ${track.title || ''}\nhttps://www.deezer.com/track/${track.id}\n${device} · ${browser} · сеть ${net} · ${zone}`;
  const url = `https://ntfy.sh/${TOPIC}?${new URLSearchParams({ title: `${game}: не играет (авто)`, tags: 'rotating_light' })}`;
  fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
}
