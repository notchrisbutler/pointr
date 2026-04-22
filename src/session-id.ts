export const SESSION_ID_PATTERN = /^[A-Za-z0-9]{5}$/;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

export function normalizeSessionId(id: string): string {
  return id.toLowerCase();
}
