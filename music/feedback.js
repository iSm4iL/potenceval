import { t } from '../shared/i18n.js?v=ui-20261029';
export function resultPresentation({ won, step, points = 0 }) {
  if (!won) return { tier: 'missed', label: points ? t('Исполнитель угадан, песня — нет. Это была…', "You got the artist. The song was…") : t('Не угадали — это была…', "Missed it. The song was…"), particles: 0 };
  return {
    tier: step === 0 ? 'instant' : step < 3 ? 'bright' : 'calm',
    label: [t('С полсекунды!', "In half a second!"), t('С одной секунды!', "In one second!"), t('С двух секунд!', "In two seconds!"), t('Есть попадание!', "Got it!"), t('Угадали!', "Got it!"), t('Угадали!', "Got it!")][step],
    particles: [100, 72, 48, 30, 18, 10][step],
  };
}
