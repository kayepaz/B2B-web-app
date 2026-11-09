// The Scan page (#/scan): scan with the camera, a handheld scanner or by
// typing a UPC.
//
// Two modes:
//   Open product - each scan opens that product's page.
//   Quick add    - each scan adds one to the cart and stays on this page,
//                  for walking along a shelf scanning items to re-order.

import { h } from './dom.js';
import { formatPrice } from './format.js';
import { addToCart, getQuantity } from './cart.js';
import { toCatalogCode } from './barcode.js';
import {
  canUseCamera, startCamera, cameraErrorMessage, scanFeedback, prepareFeedback, setScanHandler,
} from './scanner.js';

// The same barcode only counts again once it has been out of view this long,
// so holding an item in front of the camera adds it once.
const SAME_CODE_GAP_MS = 1500;

let mode = 'open'; // remembered while the app is open

export function scanView(data) {
  let camera = null;
  let lastCode = null;
  let lastSeenAt = 0;
  const added = new Map(); // productId -> { product, count } for quick add

  const status = h('p', { class: 'scan-status', role: 'status' },
    'Scan a barcode with the camera or a handheld scanner, or type a UPC below.');
  const setStatus = (message, kind = 'info') => {
    status.textContent = message;
    status.className = `scan-status scan-status-${kind}`;
  };

  const addedList = h('ul', { class: 'scan-added' });
  const addedSection = h('section', { class: 'panel scan-added-panel', hidden: true },
    h('h2', {}, 'Added in this session'),
    addedList,
    h('a', { class: 'primary-button', href: '#/cart' }, 'View cart'));

  function renderAdded() {
    addedSection.hidden = added.size === 0;
    addedList.replaceChildren(...[...added.values()].reverse().map(({ product, count }) => h('li', {},
      h('span', {}, h('a', { href: `#/p/${encodeURIComponent(product.id)}` }, product.name),
        h('span', { class: 'product-meta' }, ` ${product.itemNumber} · ${formatPrice(product.priceCents)}`)),
      h('strong', {}, `+${count}`))));
  }

  function handleCode(code) {
    const now = Date.now();
    const stillInView = code === lastCode && now - lastSeenAt < SAME_CODE_GAP_MS;
    lastCode = code;
    lastSeenAt = now;
    if (stillInView) return;

    const product = data.productsByUpc.get(code);
    if (!product) {
      scanFeedback(false);
      setStatus(`Barcode ${code} isn't in the catalogue.`, 'error');
      return;
    }
    if (mode === 'open') {
      scanFeedback(true);
      camera?.stop();
      camera = null;
      location.hash = `#/p/${encodeURIComponent(product.id)}`;
      return;
    }
    if (product.status === 'Discontinued') {
      scanFeedback(false);
      setStatus(`${product.name} is discontinued and can't be ordered.`, 'error');
      return;
    }
    addToCart(product.id, 1);
    scanFeedback(true);
    const entry = added.get(product.id) ?? { product, count: 0 };
    entry.count += 1;
    added.set(product.id, entry);
    renderAdded();
    setStatus(`Added 1 × ${product.name}. ${getQuantity(product.id)} in cart.`, 'success');
  }

  // Handheld scans go to this page while it's open. Each one is deliberate,
  // so scanning the same item twice adds two.
  setScanHandler((code) => {
    lastCode = null;
    handleCode(code);
  });

  // ---- Mode choice
  const modeChoice = h('fieldset', { class: 'scan-mode' },
    h('legend', {}, 'When a barcode is scanned'),
    ...[['open', 'Open the product'], ['quick', 'Quick add: add 1 to the cart and keep scanning']]
      .map(([value, label]) => h('label', {},
        h('input', {
          type: 'radio',
          name: 'scan-mode',
          value,
          checked: mode === value,
          onchange: () => { mode = value; lastCode = null; },
        }),
        ` ${label}`)));

  // ---- Camera
  const video = h('video', { class: 'scan-video', 'aria-label': 'Camera view' });
  const viewer = h('div', { class: 'scan-viewer', hidden: true },
    video, h('div', { class: 'scan-guide', 'aria-hidden': 'true' }));
  const readerNote = h('p', { class: 'fine-print' });
  const cameraButton = h('button', { type: 'button', class: 'primary-button' }, 'Start camera');

  cameraButton.addEventListener('click', async () => {
    if (camera) {
      camera.stop();
      camera = null;
      viewer.hidden = true;
      cameraButton.textContent = 'Start camera';
      readerNote.textContent = '';
      return;
    }
    prepareFeedback(); // browsers only allow sound after a click like this one
    cameraButton.disabled = true;
    setStatus('Starting the camera…');
    try {
      viewer.hidden = false;
      camera = await startCamera(video, handleCode);
      cameraButton.textContent = 'Stop camera';
      setStatus('Hold the barcode inside the box, about a hand’s length away.');
      readerNote.textContent = camera.usingBuiltIn
        ? "Using your browser's built-in barcode reader."
        : "Using this app's barcode reader.";
    } catch (error) {
      console.warn(error);
      viewer.hidden = true;
      setStatus(cameraErrorMessage(error), 'error');
    } finally {
      cameraButton.disabled = false;
    }
  });

  const cameraSection = canUseCamera()
    ? h('div', { class: 'scan-camera' }, cameraButton, viewer, readerNote)
    : h('p', { class: 'status-note status-backordered' },
      "Camera scanning isn't available in this browser. You can still use a handheld scanner or type a UPC.");

  // ---- Typing a UPC
  const manualInput = h('input', {
    type: 'text',
    inputmode: 'numeric',
    id: 'manual-upc',
    autocomplete: 'off',
    maxlength: 14,
    placeholder: '12-digit UPC',
  });
  const manualForm = h('form', {
    class: 'scan-manual',
    onsubmit: (event) => {
      event.preventDefault(); // handled here; nothing is sent anywhere
      const code = toCatalogCode(manualInput.value);
      if (!code) {
        setStatus('That isn’t a valid UPC. Check the 12 digits under the barcode.', 'error');
        return;
      }
      lastCode = null; // typing the same code again is deliberate
      handleCode(code);
      manualInput.value = '';
    },
  },
  h('label', { for: 'manual-upc', class: 'field-label' }, 'Or type a UPC'),
  h('div', { class: 'scan-manual-row' },
    manualInput,
    h('button', { type: 'submit', class: 'primary-button' }, 'Look up')));

  const content = h('section', { class: 'scan-page' },
    h('h1', {}, 'Scan barcodes'),
    modeChoice,
    status,
    cameraSection,
    addedSection,
    manualForm,
    h('p', { class: 'fine-print' },
      'Using a USB or Bluetooth handheld scanner? Just scan; it works on any page. ',
      'Need something to scan? Print the ',
      h('a', { href: '#/barcodes' }, 'sample barcode sheet'),
      '.'));

  return {
    title: 'Scan barcodes',
    content,
    cleanup() {
      camera?.stop();
      camera = null;
      setScanHandler(null);
    },
  };
}
