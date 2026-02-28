import { DurableObject } from 'cloudflare:workers';

interface Player {
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

interface PlayerAttachment {
  name: string;
  vote: string | number | null;
  isObserver: boolean;
}

const DEFAULT_POINT_VALUES: (number | string)[] = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?'];

export class PokerSession extends DurableObject {
  private players: Map<WebSocket, Player> = new Map();
  private revealed: boolean = false;
  private storyDescription: string = '';
  private roundStartTime: number = Date.now();
  private pointValues: (number | string)[] = DEFAULT_POINT_VALUES;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Reconstruct player map from hibernated WebSockets
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as PlayerAttachment | null;
      if (attachment) {
        this.players.set(ws, {
          name: attachment.name,
          vote: attachment.vote,
          isObserver: attachment.isObserver,
        });
      }
    }
  }

  async fetch(_request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const type = data.type as string;

    switch (type) {
      case 'join': {
        const rawName = String(data.name ?? '').trim().slice(0, 30);
        if (!rawName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Name is required' }));
          return;
        }
        const isObserver = Boolean(data.isObserver);
        const player: Player = { name: rawName, vote: null, isObserver };
        this.players.set(ws, player);
        ws.serializeAttachment({ name: rawName, vote: null, isObserver });
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
          // Allow null to deselect/clear vote
          player.vote = null;
        } else if (!this.pointValues.includes(voteValue as string | number)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid vote value' }));
          return;
        } else {
          player.vote = voteValue as string | number;
        }
        ws.serializeAttachment({ name: player.name, vote: player.vote, isObserver: player.isObserver });
        this.broadcastState();
        break;
      }

      case 'reveal': {
        this.revealed = true;
        this.broadcastState();
        break;
      }

      case 'clear': {
        this.revealed = false;
        this.roundStartTime = Date.now();
        for (const [socket, player] of this.players) {
          player.vote = null;
          socket.serializeAttachment({ name: player.name, vote: null, isObserver: player.isObserver });
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

      default: {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.players.delete(ws);
    this.broadcastState();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.players.delete(ws);
    this.broadcastState();
  }

  private broadcastState(): void {
    const playerList = Array.from(this.players.values()).map((player) => ({
      name: player.name,
      voted: player.vote !== null,
      vote: this.revealed ? player.vote : null,
      isObserver: player.isObserver,
    }));

    const stateMessage = JSON.stringify({
      type: 'state',
      players: playerList,
      revealed: this.revealed,
      story: this.storyDescription,
      roundStartTime: this.roundStartTime,
      pointValues: this.pointValues,
    });

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(stateMessage);
      } catch {
        // WebSocket may be in a closing state; clean up
        this.players.delete(ws);
      }
    }
  }
}
