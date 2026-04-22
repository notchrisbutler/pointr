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

type ClientStorage = Pick<
  {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  },
  'getItem' | 'setItem'
>;

export function getClientStorageKey(sessionId: string): string {
  return `pointr:session:${sessionId}:clientId`;
}

export function getOrCreateClientId(
  storage: ClientStorage,
  sessionId: string,
  createId: () => string,
): string {
  const key = `pointr:session:${sessionId}:clientId`;
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
