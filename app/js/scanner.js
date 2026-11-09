// Barcode scanning input: the device camera and handheld scanners.
//
// Camera: uses the browser's built-in BarcodeDetector where it exists
// (e.g. Chrome on Android, ChromeOS and macOS), and otherwise our own reader
// in barcode.js. Camera images are processed on the device; nothing is
// uploaded.
//
// Handheld scanners (USB or Bluetooth) act like a keyboard: they type the
// digits very quickly and press Enter. We spot that pattern anywhere in
// the app. No human types 12 digits that fast.

import { decodeImageData, toCatalogCode } from './barcode.js';

// ---------------------------------------------------------------- Feedback

let audio = null;

// Call from a click: browsers only allow sound after the user interacts.
export function prepareFeedback() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    // Sound isn't essential.
  }
}

// A short beep and buzz; a lower, longer one for problems.
export function scanFeedback(ok = true) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = ok ? 1200 : 280;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + (ok ? 0.09 : 0.25));
  } catch {
    // Sound isn't essential.
  }
  navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
}

// ---------------------------------------------------------------- Camera

export function canUseCamera() {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

const SCAN_INTERVAL_MS = 120;

async function builtInDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = ['ean_13', 'upc_a'].filter((format) => supported.includes(format));
    return formats.length ? new window.BarcodeDetector({ formats }) : null;
  } catch {
    return null;
  }
}

export function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
      return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
      return 'The camera is being used by another app. Close it and try again.';
    default:
      return 'The camera could not be started.';
  }
}

// Starts the camera in the <video> element and calls onCode(code) for each
// barcode read. Returns { stop(), usingBuiltIn }. Throws if the camera
// can't be started (see cameraErrorMessage).
export async function startCamera(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.muted = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  await video.play();

  const detector = await builtInDetector();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let timer = null;
  let previous = null;

  async function readFrame() {
    if (detector) {
      const found = await detector.detect(video);
      for (const barcode of found) {
        const code = toCatalogCode(barcode.rawValue);
        if (code) return code;
      }
      return null;
    }
    // Our reader looks at the middle of the picture, where the guide box is.
    const width = video.videoWidth;
    const height = video.videoHeight;
    const cropWidth = Math.round(width * 0.8);
    const cropHeight = Math.round(height * 0.6);
    const scale = Math.min(1, 1000 / cropWidth);
    canvas.width = Math.round(cropWidth * scale);
    canvas.height = Math.round(cropHeight * scale);
    context.drawImage(video, (width - cropWidth) / 2, (height - cropHeight) / 2,
      cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const raw = decodeImageData(context.getImageData(0, 0, canvas.width, canvas.height));
    const code = raw ? toCatalogCode(raw) : null;
    // Extra safety: our reader must see the same code in two frames in a row.
    const confirmed = code && code === previous ? code : null;
    previous = code;
    return confirmed;
  }

  async function tick() {
    if (stopped) return;
    try {
      if (!document.hidden && video.readyState >= 2 && video.videoWidth) {
        const code = await readFrame();
        if (code && !stopped) onCode(code);
      }
    } catch (error) {
      console.warn('Barcode reading failed for one frame.', error);
    }
    if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
  }
  tick();

  return {
    usingBuiltIn: Boolean(detector),
    stop() {
      stopped = true;
      clearTimeout(timer);
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}

// ---------------------------------------------------------------- Handheld scanners

const MAX_GAP_MS = 50; // longest pause between a scanner's keystrokes
const MAX_AVERAGE_MS = 30; // scanners average well under this per digit

let pageHandler = null;

// Lets a page (the Scan page) handle handheld scans itself while it's open.
// Pass null to go back to the default.
export function setScanHandler(handler) {
  pageHandler = handler;
}

// Calls defaultHandler(code) for each handheld scan, unless a page has set
// its own handler with setScanHandler().
export function listenForHandheldScanner(defaultHandler) {
  let digits = '';
  let first = 0;
  let last = 0;
  let target = null;
  let valueBefore = null;
  const reset = () => { digits = ''; target = null; valueBefore = null; };

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) { reset(); return; }
    const now = event.timeStamp;

    if (/^[0-9]$/.test(event.key)) {
      if (digits && now - last > MAX_GAP_MS) reset();
      if (!digits) {
        first = now;
        target = event.target;
        valueBefore = typeof target?.value === 'string' ? target.value : null;
      }
      digits += event.key;
      last = now;
      return;
    }

    const looksLikeScan = (event.key === 'Enter' || event.key === 'Tab')
      && digits.length >= 12
      && now - last <= MAX_GAP_MS * 2
      && (last - first) / (digits.length - 1) <= MAX_AVERAGE_MS;
    const code = looksLikeScan ? toCatalogCode(digits) : null;
    if (code) {
      // Don't let the scanner's Enter submit a form or press a button, and
      // undo the digits it typed into whatever box had focus.
      event.preventDefault();
      event.stopPropagation();
      if (valueBefore !== null && target.value !== valueBefore) target.value = valueBefore;
      reset();
      (pageHandler ?? defaultHandler)(code);
      return;
    }
    reset();
  }, true);
}
