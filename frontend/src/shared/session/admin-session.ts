const STORAGE_KEY = "baito.adminToken";

export function getAdminToken() {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}
