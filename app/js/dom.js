// Small helper for building page elements.
//
// Text is always added as text, never parsed as HTML, so data can't inject
// markup or scripts into the page. Please don't use innerHTML in this app.
//
// Example:
//   h('a', { href: '#/', class: 'link' }, 'Home')
//   h('button', { type: 'button', onclick: () => alert('hi') }, 'Click me')

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
