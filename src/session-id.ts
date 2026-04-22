export const SESSION_ID_PATTERN = /^[a-z0-9]{1,8}$/;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}
