import { Hono } from 'hono';

type Bindings = {
  POKER_SESSION: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => {
  return c.text('Pointr - Coming Soon');
});

app.get('/ws/:id', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }
  const id = c.env.POKER_SESSION.idFromName(c.req.param('id'));
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(c.req.raw);
});

export { PokerSession } from './session';

export default app;
