const notice = document.createElement('div');
notice.className = 'preview-notice';
notice.innerHTML = '<span>Локальный предпросмотр</span><span>Оформление музыкального автомата</span>';
document.querySelector('.music-wrap').prepend(notice);
await import('./cabinet.js?v=cabinet-20261023');
