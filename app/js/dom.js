// Small helper for building page elements.
//
// Text is always added as text, never parsed as HTML, so data can't inject
// markup or scripts into the page. Please don't use innerHTML in this app.
//
// Example:
//   h('a', { href: '#/', class: 'link' }, 'Home')
//   h('button', { type: 'button', onclick: () => alert('hi') }, 'Click me')

// Show a short message at the bottom of the screen for a few seconds.
// kind: 'info', 'success' or 'error'. Screen readers announce it too.
let toastTimer;
export function showToast(message, kind = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${kind}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

// Read a short message to screen-reader users (e.g. "Added to cart").
export function announce(message) {
  const region = document.getElementById('announcer');
  if (!region) return;
  region.textContent = '';
  // A short delay makes screen readers notice repeated identical messages.
  setTimeout(() => { region.textContent = message; }, 50);
}

export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2), value);
    } else if (name === 'class') {
      element.className = value;
    } else {
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }

  return element;
}
