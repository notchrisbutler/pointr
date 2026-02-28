import { Hono } from 'hono';

type Bindings = {
  POKER_SESSION: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => {
  return c.text('Pointr - Coming Soon');
});

// Placeholder Durable Object stub — full implementation in Task 2
export class PokerSession {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  async fetch(_request: Request): Promise<Response> {
    return new Response('PokerSession stub');
  }
}

export default app;
