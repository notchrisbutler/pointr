import { Hono } from 'hono';
import { homePage } from './pages/home';
import { sessionPage } from './pages/session';
import { CLIENT_JS } from './client';

type Bindings = {
  POKER_SESSION: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => c.html(homePage()));

app.post('/create', (c) => {
  const id = Math.random().toString(36).substring(2, 8);
  return c.redirect('/' + id);
});

app.get('/api/:id/info', async (c) => {
  const id = c.env.POKER_SESSION.idFromName(c.req.param('id'));
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(new Request(new URL('/info', c.req.url)));
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

app.get('/client.js', (c) => {
  return c.body(CLIENT_JS, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/:id', (c) => {
  const id = c.req.param('id');
  if (id.length > 8 || !/^[a-z0-9]+$/.test(id)) return c.redirect('/');
  return c.html(sessionPage(id));
});

export default app;
