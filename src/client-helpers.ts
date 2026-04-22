export interface JoinedPayload {
  type: "joined";
  clientId: string;
  name: string;
  isHost: boolean;
  isObserver: boolean;
}

export interface SelfState {
  clientId: string;
  name: string;
  amHost: boolean;
  isObserver: boolean;
}

export function getClientStorageKey(sessionId: string): string {
  return `pointr:session:${sessionId}:clientId`;
}

export function getOrCreateClientId(
  storage: Pick<Storage, "getItem" | "setItem">,
  sessionId: string,
  createId: () => string,
): string {
  const key = getClientStorageKey(sessionId);
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = createId();
  storage.setItem(key, next);
  return next;
}

export function shouldReconnect(input: {
  timedOut: boolean;
  closeCode: number;
  socketGeneration: number;
  activeGeneration: number;
}): boolean {
  return !input.timedOut && input.closeCode !== 4000 && input.socketGeneration === input.activeGeneration;
}

export function applyJoinedPayload(current: SelfState, payload: JoinedPayload): SelfState {
  return {
    clientId: payload.clientId,
    name: payload.name,
    amHost: payload.isHost,
    isObserver: payload.isObserver,
  };
}
