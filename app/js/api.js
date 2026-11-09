// Talks to the order-processing system.
//
// For now this only PRETENDS to send: it waits briefly and returns a made-up
// confirmation number. To connect a real system, replace the body of
// sendOrderRequest() with a fetch() POST to its API (and add that server to
// connect-src in the Content Security Policy in index.html).

const PRETEND_DELAY_MS = 800;

export async function sendOrderRequest(orderRequest) {
  if (!navigator.onLine) {
    throw new Error('Offline');
  }
  await new Promise((resolve) => setTimeout(resolve, PRETEND_DELAY_MS));
  return {
    confirmationNumber: `CONF-${randomCode(8)}`,
    receivedAt: new Date().toISOString(),
    // A real system would receive orderRequest here.
    receivedLines: orderRequest.lines.length,
  };
}

export function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
