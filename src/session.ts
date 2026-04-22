import { DurableObject } from 'cloudflare:workers';
import { chooseCanonicalName, findReconnectCandidate } from './session-identity';

interface Player {
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

interface PlayerAttachment {
  clientId: string;
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

const DEFAULT_POINT_VALUES: (number | string)[] = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?'];
const EMOJI_NAMES = [
  '🦊', '🐙', '🐲', '🎲', '🍕', '🚀', '🎸', '🎯', '🧩', '🐼',
  '🎭', '🐺', '🦅', '🐸', '🤖', '👻', '🦉', '🐧', '🦈', '🎩',
  '🐻', '🦁', '🐯', '🐨', '🐵', '🦎', '🐢', '🦖', '🐳', '🐬',
  '🦍', '🦏', '🐘', '🦬', '🦣', '🐗', '🦇', '🐊', '🐆', '🐃',
  '🧠', '🛸', '⚡', '🔥', '💎', '🏴‍☠️', '⚙️', '🗿', '🎪', '🏔️',
  '🌋', '🧲', '🔭', '🧪', '🛡️', '⚔️', '🏹', '🪓', '🔱', '🪐',
  '😎', '🤓', '🧐', '😏', '🫡', '🤠', '🥷', '🧙', '🧑‍🚀', '🧑‍💻',
];

const MAX_MESSAGES_PER_SECOND = 20;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

function randomEmojiName(): string {
  return EMOJI_NAMES[Math.floor(Math.random() * EMOJI_NAMES.length)];
}

interface PlayerState extends Player {
  clientId: string;
}

interface RoundState {
  revealed: boolean;
  roundStartTime: number;
  revealTime: number;
  finalVote: string | number | null;
  pointValues: (number | string)[];
  discussionPausedAt: number;
  discussionPausedTotal: number;
}

export class PokerSessionSqlite extends DurableObject {
  private players: Map<WebSocket, PlayerState> = new Map();
  private revealed: boolean = false;
  private roundStartTime: number = 0;
  private revealTime: number = 0;
  private finalVote: string | number | null = null;
  private pointValues: (number | string)[] = DEFAULT_POINT_VALUES;
  private discussionPausedAt: number = 0;
  private discussionPausedTotal: number = 0;
  private messageCounts: Map<WebSocket, { count: number; windowStart: number }> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as PlayerAttachment | null;
      if (attachment) {
        this.players.set(ws, {
          clientId: attachment.clientId,
          name: attachment.name,
          vote: attachment.vote,
          isObserver: attachment.isObserver,
        });
      }
    }
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<RoundState>('roundState');
      if (saved) {
        this.revealed = saved.revealed;
        this.roundStartTime = saved.roundStartTime;
        this.revealTime = saved.revealTime;
        this.finalVote = saved.finalVote;
        this.pointValues = saved.pointValues;
        this.discussionPausedAt = saved.discussionPausedAt ?? 0;
        this.discussionPausedTotal = saved.discussionPausedTotal ?? 0;
      }
    });
  }

  private saveRoundState(): void {
    this.ctx.storage.put('roundState', {
      revealed: this.revealed,
      roundStartTime: this.roundStartTime,
      revealTime: this.revealTime,
      finalVote: this.finalVote,
      pointValues: this.pointValues,
      discussionPausedAt: this.discussionPausedAt,
      discussionPausedTotal: this.discussionPausedTotal,
    } satisfies RoundState);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/info')) {
      return Response.json({ playerCount: this.players.size });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private checkRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    let entry = this.messageCounts.get(ws);
    if (!entry || now - entry.windowStart >= 1000) {
      entry = { count: 0, windowStart: now };
      this.messageCounts.set(ws, entry);
    }
    entry.count++;
    return entry.count <= MAX_MESSAGES_PER_SECOND;
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.checkRateLimit(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Slow down.' }));
      ws.serializeAttachment(null);
      ws.close(1008, 'Rate limit exceeded');
      this.players.delete(ws);
      this.messageCounts.delete(ws);
      this.broadcastState();
      return;
    }

    // Reset idle timeout — any message from any player reschedules the alarm
    this.ctx.storage.setAlarm(Date.now() + IDLE_TIMEOUT_MS);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const type = data.type as string;

    // Require join before any other message
    if (type !== 'join' && !this.players.has(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Must join first' }));
      return;
    }

    switch (type) {
      case 'join': {
        const clientId = String(data.clientId ?? '').trim();
        if (!clientId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing client id' }));
          return;
        }

        const entries = Array.from(this.players.entries()).map(([socket, player]) => ({ socket, player }));
        const reconnectPlayer = findReconnectCandidate(
          entries.map(({ player }) => player),
          clientId,
        );
        const reconnectEntry = entries.find(({ player }) => player === reconnectPlayer) ?? null;
        const canonicalName = chooseCanonicalName({
          requestedName: String(data.name ?? ''),
          existingPlayer: reconnectEntry?.player ?? null,
          players: entries.map(({ player }) => player),
          createFallbackName: randomEmojiName,
        });

        if (reconnectEntry && reconnectEntry.socket !== ws) {
          this.players.delete(reconnectEntry.socket);
          this.messageCounts.delete(reconnectEntry.socket);
          try { reconnectEntry.socket.close(1000, 'Replaced by new connection'); } catch {}
        }

        const isObserver = Boolean(data.isObserver);
        const player: PlayerState = {
          clientId,
          name: canonicalName,
          vote: reconnectEntry?.player.vote ?? null,
          isObserver,
        };
        this.players.set(ws, player);
        ws.serializeAttachment(player);
        ws.send(JSON.stringify({
          type: 'joined',
          clientId,
          name: player.name,
          isObserver: player.isObserver,
        }));
        this.broadcastState();
        break;
      }

      case 'vote': {
        const player = this.players.get(ws);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not joined' }));
          return;
        }
        if (player.isObserver) {
          ws.send(JSON.stringify({ type: 'error', message: 'Observers cannot vote' }));
          return;
        }
        if (this.revealed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Votes already revealed' }));
          return;
        }
        const voteValue = data.value;
        if (voteValue === null) {
          player.vote = null;
        } else if (!this.pointValues.includes(voteValue as string | number)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid vote value' }));
          return;
        } else {
          player.vote = voteValue as string | number;
        }
        ws.serializeAttachment({
          clientId: player.clientId,
          name: player.name,
          vote: player.vote,
          isObserver: player.isObserver,
        });
        this.broadcastState();
        break;
      }

      case 'start': {
        this.roundStartTime = Date.now();
        this.broadcastState();
        break;
      }

      case 'reveal': {
        this.revealed = true;
        this.revealTime = Date.now();
        this.broadcastState();
        break;
      }

      case 'final': {
        if (!this.revealed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Can only set final during discussion' }));
          return;
        }
        const fv = data.value;
        const wasPaused = this.finalVote !== null;
        if (fv === null) {
          this.finalVote = null;
          // Unpausing: accumulate paused duration
          if (wasPaused && this.discussionPausedAt > 0) {
            this.discussionPausedTotal += Date.now() - this.discussionPausedAt;
            this.discussionPausedAt = 0;
          }
        } else if (!this.pointValues.includes(fv as string | number)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid final vote value' }));
          return;
        } else {
          this.finalVote = fv as string | number;
          // Pausing: record when pause started (only if not already paused)
          if (!wasPaused) {
            this.discussionPausedAt = Date.now();
          }
        }
        this.broadcastState();
        break;
      }

      case 'clear': {
        this.revealed = false;
        this.roundStartTime = 0;
        this.revealTime = 0;
        this.finalVote = null;
        this.discussionPausedAt = 0;
        this.discussionPausedTotal = 0;
        for (const [socket, player] of this.players) {
          player.vote = null;
          socket.serializeAttachment({
            clientId: player.clientId,
            name: player.name,
            vote: null,
            isObserver: player.isObserver,
          });
        }
        this.broadcastState();
        break;
      }

      default: {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.players.delete(ws);
    this.messageCounts.delete(ws);
    this.broadcastState();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.players.delete(ws);
    this.messageCounts.delete(ws);
    this.broadcastState();
  }

  async alarm(): Promise<void> {
    // Session timed out — notify all clients and tear down
    const msg = JSON.stringify({ type: 'timeout' });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
        ws.close(4000, 'Session timed out due to inactivity');
      } catch {
        // Socket already closed, ignore
      }
    }
    this.players.clear();
    this.messageCounts.clear();
    await this.ctx.storage.deleteAll();
  }

  private broadcastState(): void {
    const playerList = Array.from(this.players.values()).map((player) => ({
      name: player.name,
      voted: player.vote !== null,
      vote: this.revealed ? player.vote : null,
      isObserver: player.isObserver,
    }));

    this.saveRoundState();

    const stateMessage = JSON.stringify({
      type: 'state',
      players: playerList,
      revealed: this.revealed,
      roundStartTime: this.roundStartTime,
      revealTime: this.revealTime,
      finalVote: this.finalVote,
      pointValues: this.pointValues,
      discussionPausedAt: this.discussionPausedAt,
      discussionPausedTotal: this.discussionPausedTotal,
    });

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(stateMessage);
      } catch {
        this.players.delete(ws);
      }
    }
  }
}

// Keep the legacy KV-backed class exported until a later delete-class migration removes it.
