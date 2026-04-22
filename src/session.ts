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
  isHost: boolean;
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

const HOST_ACTIONS = new Set(['set-stories', 'skip-setup', 'story-next', 'story-prev', 'story-goto', 'transfer-host']);

function randomEmojiName(): string {
  return EMOJI_NAMES[Math.floor(Math.random() * EMOJI_NAMES.length)];
}

interface PlayerState extends Player {
  clientId: string;
  isHost: boolean;
}

interface RoundState {
  revealed: boolean;
  storyDescription: string;
  roundStartTime: number;
  revealTime: number;
  finalVote: string | number | null;
  pointValues: (number | string)[];
  stories: string[];
  currentStoryIndex: number;
  sessionReady: boolean;
  discussionPausedAt: number;
  discussionPausedTotal: number;
}

export class PokerSessionSqlite extends DurableObject {
  private players: Map<WebSocket, PlayerState> = new Map();
  private revealed: boolean = false;
  private storyDescription: string = '';
  private roundStartTime: number = 0;
  private revealTime: number = 0;
  private finalVote: string | number | null = null;
  private pointValues: (number | string)[] = DEFAULT_POINT_VALUES;
  private stories: string[] = [];
  private currentStoryIndex: number = 0;
  private sessionReady: boolean = false;
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
          isHost: attachment.isHost ?? false,
        });
      }
    }
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<RoundState>('roundState');
      if (saved) {
        this.revealed = saved.revealed;
        this.storyDescription = saved.storyDescription;
        this.roundStartTime = saved.roundStartTime;
        this.revealTime = saved.revealTime;
        this.finalVote = saved.finalVote;
        this.pointValues = saved.pointValues;
        this.stories = saved.stories;
        this.currentStoryIndex = saved.currentStoryIndex;
        this.sessionReady = saved.sessionReady;
        this.discussionPausedAt = saved.discussionPausedAt ?? 0;
        this.discussionPausedTotal = saved.discussionPausedTotal ?? 0;
      }
    });
  }

  private saveRoundState(): void {
    this.ctx.storage.put('roundState', {
      revealed: this.revealed,
      storyDescription: this.storyDescription,
      roundStartTime: this.roundStartTime,
      revealTime: this.revealTime,
      finalVote: this.finalVote,
      pointValues: this.pointValues,
      stories: this.stories,
      currentStoryIndex: this.currentStoryIndex,
      sessionReady: this.sessionReady,
      discussionPausedAt: this.discussionPausedAt,
      discussionPausedTotal: this.discussionPausedTotal,
    } satisfies RoundState);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/info')) {
      return Response.json({ playerCount: this.players.size, sessionReady: this.sessionReady });
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

  private isHost(ws: WebSocket): boolean {
    return this.players.get(ws)?.isHost === true;
  }

  private assignNewHost(): void {
    for (const [ws, player] of this.players) {
      if (!player.isObserver) {
        player.isHost = true;
        ws.serializeAttachment({
          clientId: player.clientId,
          name: player.name,
          vote: player.vote,
          isObserver: player.isObserver,
          isHost: true,
        });
        return;
      }
    }
  }

  private hasHost(): boolean {
    for (const player of this.players.values()) {
      if (player.isHost) return true;
    }
    return false;
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

    if (HOST_ACTIONS.has(type) && !this.isHost(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Only the host can do that' }));
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

        const isFirstPlayer = this.players.size === 0 && !this.sessionReady;
        if (!isFirstPlayer && !this.sessionReady) {
          this.sessionReady = true;
        }
        const shouldBeHost = reconnectEntry?.player.isHost ?? (!isObserver && !this.hasHost());
        const player: PlayerState = {
          clientId,
          name: canonicalName,
          vote: reconnectEntry?.player.vote ?? null,
          isObserver,
          isHost: shouldBeHost,
        };
        this.players.set(ws, player);
        ws.serializeAttachment(player);
        ws.send(JSON.stringify({
          type: 'joined',
          clientId,
          name: player.name,
          isHost: player.isHost,
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
          isHost: player.isHost,
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
            isHost: player.isHost,
          });
        }
        if (this.stories.length > 0 && this.currentStoryIndex < this.stories.length - 1) {
          this.currentStoryIndex++;
          this.storyDescription = this.stories[this.currentStoryIndex];
        } else if (this.stories.length === 0) {
          this.storyDescription = '';
        }
        this.broadcastState();
        break;
      }

      case 'story': {
        const rawDescription = String(data.text ?? '').slice(0, 2000);
        this.storyDescription = rawDescription;
        this.broadcastState();
        break;
      }

      case 'skip-setup': {
        this.sessionReady = true;
        this.broadcastState();
        break;
      }

      case 'set-stories': {
        const raw = data.stories;
        if (!Array.isArray(raw)) {
          ws.send(JSON.stringify({ type: 'error', message: 'stories must be an array' }));
          return;
        }
        this.sessionReady = true;
        this.stories = raw
          .map((s: unknown) => String(s ?? '').trim().slice(0, 2000))
          .filter((s: string) => s.length > 0)
          .slice(0, 50);
        this.currentStoryIndex = 0;
        if (this.stories.length > 0) {
          this.storyDescription = this.stories[0];
        } else {
          this.storyDescription = '';
        }
        this.broadcastState();
        break;
      }

      case 'story-next': {
        if (this.stories.length > 0 && this.currentStoryIndex < this.stories.length - 1) {
          this.currentStoryIndex++;
          this.storyDescription = this.stories[this.currentStoryIndex];
        }
        this.broadcastState();
        break;
      }

      case 'story-prev': {
        if (this.stories.length > 0 && this.currentStoryIndex > 0) {
          this.currentStoryIndex--;
          this.storyDescription = this.stories[this.currentStoryIndex];
        }
        this.broadcastState();
        break;
      }

      case 'story-goto': {
        const idx = Number(data.index);
        if (this.stories.length > 0 && Number.isInteger(idx) && idx >= 0 && idx < this.stories.length) {
          this.currentStoryIndex = idx;
          this.storyDescription = this.stories[this.currentStoryIndex];
        }
        this.broadcastState();
        break;
      }

      case 'transfer-host': {
        const targetName = String(data.name ?? '').trim();
        for (const [targetWs, targetPlayer] of this.players) {
          if (targetPlayer.name === targetName && !targetPlayer.isObserver) {
            const currentHost = this.players.get(ws)!;
            currentHost.isHost = false;
            ws.serializeAttachment({
              clientId: currentHost.clientId,
              name: currentHost.name,
              vote: currentHost.vote,
              isObserver: currentHost.isObserver,
              isHost: false,
            });
            targetPlayer.isHost = true;
            targetWs.serializeAttachment({
              clientId: targetPlayer.clientId,
              name: targetPlayer.name,
              vote: targetPlayer.vote,
              isObserver: targetPlayer.isObserver,
              isHost: true,
            });
            this.broadcastState();
            return;
          }
        }
        ws.send(JSON.stringify({ type: 'error', message: 'Player not found or is an observer' }));
        break;
      }

      default: {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const wasHost = this.players.get(ws)?.isHost === true;
    this.players.delete(ws);
    this.messageCounts.delete(ws);
    if (wasHost) {
      this.assignNewHost();
    }
    this.broadcastState();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const wasHost = this.players.get(ws)?.isHost === true;
    this.players.delete(ws);
    this.messageCounts.delete(ws);
    if (wasHost) {
      this.assignNewHost();
    }
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
      isHost: player.isHost,
    }));

    this.saveRoundState();

    const stateMessage = JSON.stringify({
      type: 'state',
      players: playerList,
      revealed: this.revealed,
      story: this.storyDescription,
      roundStartTime: this.roundStartTime,
      revealTime: this.revealTime,
      finalVote: this.finalVote,
      pointValues: this.pointValues,
      stories: this.stories,
      currentStoryIndex: this.currentStoryIndex,
      sessionReady: this.sessionReady,
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
