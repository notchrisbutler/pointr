export interface IdentityPlayer {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
  isHost: boolean;
}

const EMOJI_FALLBACK = ["🦊", "🐙", "🐲", "🎲", "🍕", "🚀"];

export function findReconnectCandidate(
  players: IdentityPlayer[],
  clientId: string,
): IdentityPlayer | undefined {
  return players.find((player) => player.clientId === clientId);
}

export function chooseCanonicalName(input: {
  requestedName: string;
  existingPlayer: IdentityPlayer | null;
  players: IdentityPlayer[];
}): string {
  if (input.existingPlayer) return input.existingPlayer.name;

  const requested = input.requestedName.trim().slice(0, 30);
  const base = requested || EMOJI_FALLBACK[0];
  const taken = new Set(input.players.map((player) => player.name));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}
