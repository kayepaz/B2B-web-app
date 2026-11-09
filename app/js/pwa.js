// Progressive Web App features: offline support, the Install button and the
// offline notice.

export function startPwa() {
  registerServiceWorker();
  setUpInstallButton();
  setUpOfflineBanner();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.warn('Offline support is unavailable.', error);
  });
}

// Browsers that support installing (e.g. Chrome, Edge) fire
// 'beforeinstallprompt'; we then show our own Install button. On iPhone and
// iPad, people use Share > Add to Home Screen instead.
function setUpInstallButton() {
  const button = document.getElementById('install-button');
  if (!button) return;
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    button.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    deferredPrompt = null;
  });
}

function setUpOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
