import { Hono } from 'hono';
import { HOME_CLIENT_JS } from './home-client';
import { homePage } from './pages/home';
import { sessionPage } from './pages/session';
import { CLIENT_JS } from './client';
import { isValidSessionId, normalizeSessionId } from './session-id';

type Bindings = Env;

const SESSION_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function createSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let id = '';

  for (const byte of bytes) {
    id += SESSION_ID_ALPHABET[byte % SESSION_ID_ALPHABET.length];
  }

  return id;
}

const app = new Hono<{ Bindings: Bindings }>();

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:"
  );
});

app.get('/', (c) => c.html(homePage()));

app.post('/create', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const createKey = `create:${ip}`;
  const { success } = await c.env.RATE_LIMITER_CREATE.limit({ key: createKey });
  if (!success) {
    return c.text('Rate limit exceeded. Try again later.', 429);
  }
  const id = createSessionId();
  return c.redirect('/' + id);
});

app.get('/api/:id/info', async (c) => {
  const routeSessionId = c.req.param('id');
  if (!isValidSessionId(routeSessionId)) {
    return c.json({ error: 'Invalid session id' }, 400);
  }
  const sessionId = normalizeSessionId(routeSessionId);
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const infoKey = `info:${sessionId}:${ip}`;
  const { success } = await c.env.RATE_LIMITER_INFO.limit({ key: infoKey });
  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  const id = c.env.POKER_SESSION.idFromName(sessionId);
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(new Request(new URL('/info', c.req.url)));
});

app.get('/ws/:id', async (c) => {
  const routeSessionId = c.req.param('id');
  if (!isValidSessionId(routeSessionId)) {
    return c.text('Invalid session id', 400);
  }
  const sessionId = normalizeSessionId(routeSessionId);
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const wsKey = `ws:${sessionId}:${ip}`;
  const { success } = await c.env.RATE_LIMITER_WS.limit({ key: wsKey });
  if (!success) {
    return c.text('Rate limit exceeded. Try again later.', 429);
  }
  const id = c.env.POKER_SESSION.idFromName(sessionId);
  const stub = c.env.POKER_SESSION.get(id);
  return stub.fetch(c.req.raw);
});

export { PokerSession, PokerSessionSqlite } from './session';

app.get('/client.js', (c) => {
  return c.body(CLIENT_JS, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/home.js', (c) => {
  return c.body(HOME_CLIENT_JS, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/:id', (c) => {
  const routeSessionId = c.req.param('id');
  if (!isValidSessionId(routeSessionId)) return c.redirect('/');
  const sessionId = normalizeSessionId(routeSessionId);
  return c.html(sessionPage(sessionId));
});

export default app;
