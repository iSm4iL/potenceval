export function resultPresentation({ won, step }) {
  if (!won) return { tier: 'missed', label: 'Не угадали — это была…', particles: 0 };
  return {
    tier: step === 0 ? 'instant' : step < 3 ? 'bright' : 'calm',
    label: ['С полсекунды!', 'С одной секунды!', 'С двух секунд!', 'Есть попадание!', 'Угадали!', 'Угадали!'][step],
    particles: [100, 72, 48, 30, 18, 10][step],
  };
}
