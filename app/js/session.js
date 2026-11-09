// Remembers which sample user is signed in.
//
// This is a stand-in for Microsoft Entra single sign-on. It only stores the
// chosen customer's ID in the browser; there is no real authentication.

const KEY = 'b2b.customerId';

// Used if browser storage is unavailable (e.g. some private-browsing modes);
// the user then stays signed in only until the page is reloaded.
let fallback = null;

export function currentCustomerId() {
  try {
    return localStorage.getItem(KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

export function signIn(customerId) {
  fallback = customerId;
  try {
    localStorage.setItem(KEY, customerId);
  } catch {
    // Keep the fallback only.
  }
}

export function signOut() {
  fallback = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing else to clear.
  }
}
