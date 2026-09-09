const STORAGE_KEY = 'hunter_system_v1';

export function saveToStorage(data: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFromStorage(): any {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}