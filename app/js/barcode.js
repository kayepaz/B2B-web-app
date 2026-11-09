// UPC-A / EAN-13 barcodes: drawing them as SVG and reading them from images.
//
// No libraries. UPC-A (12 digits) is the same as EAN-13 (13 digits) with a
// leading 0, so both are handled by one EAN-13 reader.
//
// How a UPC-A barcode is laid out, left to right (1 module = thinnest bar):
//   quiet zone | start guard 101 | 6 digits × 7 modules | middle guard 01010
//   | 6 digits × 7 modules | end guard 101 | quiet zone
// Each digit is 2 bars and 2 spaces. The left digits come in two "parities"
// (L and G); for EAN-13 the parity pattern encodes the hidden first digit.
// The last digit is a check digit, which lets us reject most misreads.

// ---------------------------------------------------------------- Tables

// Widths (in modules) of space, bar, space, bar for each digit's L code.
// R codes (bar, space, bar, space) use the same widths; G codes are reversed.
const L_WIDTHS = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112']
  .map((code) => [...code].map(Number));
const G_WIDTHS = L_WIDTHS.map((widths) => [...widths].reverse());

// Bit patterns (1 = bar) for drawing.
const L_BITS = ['0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'];
const R_BITS = L_BITS.map((bits) => [...bits].map((b) => (b === '1' ? '0' : '1')).join(''));
const G_BITS = R_BITS.map((bits) => [...bits].reverse().join(''));

// Parity of the 6 left digits for each possible first EAN-13 digit.
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// ---------------------------------------------------------------- Check digits

export function ean13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code) === Number(code[12]);
}

// Accepts a scanned or typed code (UPC-A, EAN-13 starting with 0, or
// UPC-A without its leading zeros) and returns a 12-digit UPC-A, or null.
export function normalizeToUpc(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 13 && digits[0] === '0') return isValidEan13(digits) ? digits.slice(1) : null;
  if (digits.length === 12) return isValidEan13(`0${digits}`) ? digits : null;
  return null;
}

// Turns a scanned code into the form the catalogue uses: a 12-digit UPC-A
// when possible, otherwise a valid 13-digit EAN-13 (which won't be in this
// catalogue, but can be reported). Returns null if the code isn't valid.
export function toCatalogCode(raw) {
  const upc = normalizeToUpc(raw);
  if (upc) return upc;
  const digits = String(raw).replace(/\D/g, '');
  return isValidEan13(digits) ? digits : null;
}

// ---------------------------------------------------------------- Drawing

// The 95 modules (as '0'/'1') of an EAN-13 code.
export function ean13Modules(ean13) {
  const parity = PARITY[Number(ean13[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i += 1) {
    const digit = Number(ean13[i]);
    bits += parity[i - 1] === 'L' ? L_BITS[digit] : G_BITS[digit];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i += 1) bits += R_BITS[Number(ean13[i])];
  return `${bits}101`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

// Draw a UPC-A barcode as an <svg> element, with the digits underneath.
export function upcBarcodeSvg(upc, { label = `Barcode for UPC ${upc}` } = {}) {
  const ean = `0${upc}`;
  const bits = ean13Modules(ean);
  const quiet = 9;
  const barHeight = 60;
  const longBar = 66;
  const width = quiet * 2 + 95;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} 76`,
    class: 'barcode',
    role: 'img',
    'aria-label': label,
  });
  svg.append(svgElement('rect', { width, height: 76, fill: '#ffffff' }));

  // Guard bars and the first and last digits' bars are drawn longer.
  const isLong = (i) => i < 3 + 7 || (i >= 45 && i < 50) || i >= 95 - 3 - 7;
  let path = '';
  for (let i = 0; i < 95; i += 1) {
    if (bits[i] !== '1') continue;
    // Merge neighbouring modules of the same height into one bar.
    let run = 1;
    while (i + run < 95 && bits[i + run] === '1' && isLong(i + run) === isLong(i)) run += 1;
    path += `M${quiet + i} 0h${run}v${isLong(i) ? longBar : barHeight}h-${run}z`;
    i += run - 1;
  }
  svg.append(svgElement('path', { d: path, fill: '#000000' }));

  const text = (x, value, anchor = 'middle') => {
    const node = svgElement('text', {
      x, y: 74, 'font-size': 10, 'font-family': 'monospace', 'text-anchor': anchor, fill: '#000000',
    });
    node.textContent = value;
    return node;
  };
  svg.append(
    text(quiet - 2, upc[0], 'end'),
    text(quiet + 3 + 7 + 17.5, upc.slice(1, 6)),
    text(quiet + 50 + 17.5, upc.slice(6, 11)),
    text(quiet + 95 + 2, upc[11], 'start'),
  );
  return svg;
}

// ---------------------------------------------------------------- Reading

const MIN_AGREEING_LINES = 2;

// Match 4 element widths to the closest digit pattern. Rejects the match if
// it's poor, or if another digit fits almost as well (an ambiguous read).
function matchDigit(widths, tables) {
  const total = widths[0] + widths[1] + widths[2] + widths[3];
  const scaled = widths.map((w) => (w * 7) / total);
  let best = null;
  let secondError = Infinity;
  for (const [set, patterns] of tables) {
    for (let digit = 0; digit < 10; digit += 1) {
      const pattern = patterns[digit];
      let error = 0;
      for (let i = 0; i < 4; i += 1) error += Math.abs(scaled[i] - pattern[i]);
      if (!best || error < best.error) {
        if (best) secondError = best.error;
        best = { digit, set, error };
      } else if (error < secondError) {
        secondError = error;
      }
    }
  }
  if (!best || best.error > 1.6 || secondError - best.error < 0.3) return null;
  return best;
}

const LEFT_TABLES = [['L', L_WIDTHS], ['G', G_WIDTHS]];
const RIGHT_TABLES = [['R', L_WIDTHS]];

function near(value, expected, tolerance) {
  return value >= expected * (1 - tolerance) && value <= expected * (1 + tolerance);
}

// runs: widths of alternating dark/light runs; runs[i] is dark when
// isDark(i). Returns a 13-digit EAN-13 code or null.
function decodeRuns(runs, firstIsDark) {
  const isDark = (i) => (i % 2 === 0) === firstIsDark;
  const sum = (from, count) => {
    let total = 0;
    for (let i = from; i < from + count; i += 1) total += runs[i];
    return total;
  };

  for (let start = 1; start + 59 <= runs.length; start += 1) {
    if (!isDark(start)) continue;
    const module = sum(start, 3) / 3;
    if (module < 0.8) continue;
    // A quiet (light) zone must come before the start guard.
    if (runs[start - 1] < module * 3) continue;
    if (!near(runs[start], module, 0.7) || !near(runs[start + 1], module, 0.7)
      || !near(runs[start + 2], module, 0.7)) continue;

    let index = start + 3;
    const digits = [];
    let parity = '';
    let ok = true;

    for (let k = 0; k < 6 && ok; k += 1) {
      const widths = runs.slice(index, index + 4);
      if (!near(sum(index, 4), module * 7, 0.45)) { ok = false; break; }
      const match = matchDigit(widths, LEFT_TABLES);
      if (!match) { ok = false; break; }
      digits.push(match.digit);
      parity += match.set;
      index += 4;
    }
    if (!ok) continue;

    // Middle guard: 5 thin elements.
    if (!near(sum(index, 5), module * 5, 0.5)) continue;
    index += 5;

    for (let k = 0; k < 6 && ok; k += 1) {
      const widths = runs.slice(index, index + 4);
      if (!near(sum(index, 4), module * 7, 0.45)) { ok = false; break; }
      const match = matchDigit(widths, RIGHT_TABLES);
      if (!match) { ok = false; break; }
      digits.push(match.digit);
      index += 4;
    }
    if (!ok) continue;

    // End guard: 3 thin elements.
    if (!near(sum(index, 3), module * 3, 0.6)) continue;

    const first = PARITY.indexOf(parity);
    if (first === -1) continue;
    const code = `${first}${digits.join('')}`;
    if (isValidEan13(code)) return code;
  }
  return null;
}

// Turn a line of brightness values into dark/light runs.
function toRuns(line) {
  const n = line.length;
  // Overall contrast from the 5th and 95th percentile brightness.
  const histogram = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) histogram[line[i]] += 1;
  let low = 0;
  let high = 255;
  for (let seen = 0; low < 255 && seen + histogram[low] < n * 0.05; low += 1) seen += histogram[low];
  for (let seen = 0; high > 0 && seen + histogram[high] < n * 0.05; high -= 1) seen += histogram[high];
  if (high - low < 24) return null; // too little contrast to contain a barcode

  // Threshold: halfway between the overall midpoint and the local average,
  // which copes with uneven lighting across the barcode.
  const middle = (low + high) / 2;
  const radius = Math.max(8, Math.round(n / 24));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + line[i];

  const runs = [];
  let firstIsDark = null;
  let current = null;
  let length = 0;
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - radius);
    const b = Math.min(n, i + radius + 1);
    const local = (prefix[b] - prefix[a]) / (b - a);
    const dark = line[i] < (local + middle) / 2;
    if (dark === current) {
      length += 1;
    } else {
      if (current !== null) runs.push(length);
      else firstIsDark = dark;
      current = dark;
      length = 1;
    }
  }
  runs.push(length);
  return { runs, firstIsDark };
}

// Doubles a line's resolution by interpolation, which measures thin bars
// (around 2 pixels or less) more precisely.
function upsample(line) {
  const out = new Uint8Array(line.length * 2 - 1);
  for (let i = 0; i < line.length - 1; i += 1) {
    out[i * 2] = line[i];
    out[i * 2 + 1] = (line[i] + line[i + 1]) >> 1;
  }
  out[out.length - 1] = line[line.length - 1];
  return out;
}

function decodeLine(line) {
  return decodeLineAt(line) ?? decodeLineAt(upsample(line));
}

function decodeLineAt(line) {
  const result = toRuns(line);
  if (!result) return null;
  const { runs, firstIsDark } = result;
  const forward = decodeRuns(runs, firstIsDark);
  if (forward) return forward;
  // Try right-to-left, for barcodes held upside down.
  const lastIsDark = ((runs.length - 1) % 2 === 0) === firstIsDark;
  return decodeRuns([...runs].reverse(), lastIsDark);
}

// Read a barcode from image pixels (an ImageData from a canvas).
// Scans several horizontal lines, then vertical ones for barcodes held
// sideways. A code is only returned if at least two scan lines agree,
// which guards against misreads. Returns a 13-digit EAN-13 code or null.
export function decodeImageData({ data, width, height }) {
  const gray = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  const votes = new Map();
  const vote = (code) => { if (code) votes.set(code, (votes.get(code) ?? 0) + 1); };

  // Each scan line averages 3 neighbouring rows/columns to reduce noise.
  const lines = 15;
  const row = new Uint8Array(width);
  for (let k = 0; k < lines; k += 1) {
    const y = Math.min(height - 2, Math.max(1, Math.round(height * (0.2 + (0.6 * k) / (lines - 1)))));
    for (let x = 0; x < width; x += 1) {
      row[x] = (gray[(y - 1) * width + x] + gray[y * width + x] + gray[(y + 1) * width + x]) / 3;
    }
    vote(decodeLine(row));
  }
  if (![...votes.values()].some((count) => count >= MIN_AGREEING_LINES)) {
    const column = new Uint8Array(height);
    for (let k = 0; k < lines; k += 1) {
      const x = Math.min(width - 2, Math.max(1, Math.round(width * (0.2 + (0.6 * k) / (lines - 1)))));
      for (let y = 0; y < height; y += 1) {
        const base = y * width + x;
        column[y] = (gray[base - 1] + gray[base] + gray[base + 1]) / 3;
      }
      vote(decodeLine(column));
    }
  }

  let best = null;
  for (const [code, count] of votes) {
    if (!best || count > best.count) best = { code, count };
  }
  return best && best.count >= MIN_AGREEING_LINES ? best.code : null;
}
