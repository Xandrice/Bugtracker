/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

test('API intake rejects malformed JSON shapes before database calls', async () => {
  const load = loader({ '@/lib/db': { db: {} }, '@/lib/discord-intake': { authorizeDiscordWebhook: () => null }, '@/lib/discord': {}, '@/lib/issue-backlog': {} });
  const { POST } = load('src/app/api/issues/route.ts');
  for (const value of [null, [], 'text', { title: 123 }, { title: 'Bug', discordUserId: [] }, { title: 'Bug', discordUserId: '123', type: 'INVALID' }]) {
    const response = await POST(new Request('http://localhost/api/issues', { method: 'POST', body: JSON.stringify(value) }));
    assert.equal(response.status, 400, JSON.stringify(value));
  }
  assert.equal((await POST(new Request('http://localhost/api/issues', { method: 'POST', body: '{' }))).status, 400);
});

test('bulk action reports mixed outcomes and rejects anonymous writes', async () => {
  let signedIn = true;
  const calls = [];
  const load = loader({
    '@/../auth': { auth: async () => signedIn ? { user: { id: 'actor', name: 'Staff' } } : null },
    '@/lib/db': { db: {} }, '@/lib/permissions': { getPermissionContext: async () => ({}) },
    '@/lib/staff': {}, '@/lib/member-profiles': {}, '@/lib/discord': {}, '@/lib/activity': {}, '@/lib/issue-watchers': {}, '@/lib/issue-backlog': {},
    'next/cache': { revalidatePath: () => {} },
    '@/lib/issue-mutations': { mutateIssue: async (id, input) => { calls.push([id, input]); return id === 'bad' ? { error: 'Could not save' } : { issue: { id, ...input } }; } },
  });
  const { bulkUpdateIssues, createIssue } = load('src/app/actions.ts');
  const invalid = new FormData(); invalid.set('title', ' ');
  assert.ok((await createIssue(invalid)).fieldErrors.title);
  const result = await bulkUpdateIssues(['good', 'bad', 'good'], { status: 'REVIEW', assigneeId: 'staff' });
  assert.equal(result.updated, 1);
  assert.deepEqual(result.skipped, [{ id: 'bad', error: 'Could not save' }]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0][1], { status: 'REVIEW', assigneeId: 'staff' });
  signedIn = false;
  assert.equal((await bulkUpdateIssues(['good'], { status: 'DONE' })).error, 'Unauthorized');
  assert.equal(calls.length, 2);
});

test('saved views return a real identifier and delete only the current user record', async () => {
  let removed;
  const load = loader({ '@/../auth': { auth: async () => ({ user: { id: 'staff' } }) }, '@/lib/db': { db: { savedView: {
    create: async ({ data }) => ({ id: 'persisted-id', ...data }), deleteMany: async ({ where }) => { removed = where; },
  } } }, '@/lib/permissions': {}, '@/lib/staff': {}, '@/lib/discord': {}, 'next/cache': { revalidatePath: () => {} } });
  const { saveSavedView, deleteSavedView } = load('src/app/staff-actions.ts');
  const result = await saveSavedView(' My bugs ', { status: 'ACTIVE', sort: 'priority' });
  assert.equal(result.view.id, 'persisted-id');
  assert.equal(result.view.name, 'My bugs');
  await deleteSavedView(result.view.id);
  assert.deepEqual(removed, { id: 'persisted-id', userId: 'staff' });
});

test('comments render from the database before a non-blocking catch-up, and public reads hide internal notes', async () => {
  const events = []; const callbacks = []; let filter;
  const stored = [{ id: 'stored' }];
  const load = loader({ 'next/server': { after: callback => callbacks.push(callback) }, 'src/lib/db': { db: { note: { findMany: async ({where}) => { filter = where; events.push('read'); return stored; } } } }, './discordSync': { syncIssueNotesFromDiscord: async () => { events.push('sync'); throw new Error('offline'); } } });
  const { loadIssueComments } = load('src/lib/issue-comments.ts');
  assert.equal((await loadIssueComments('issue')).notes[0].id, 'stored'); assert.equal(filter.internal, false); assert.deepEqual(events, ['read']);
  await callbacks[0](); assert.deepEqual(events, ['read', 'sync']);
  await loadIssueComments('issue', true); assert.equal(filter.internal, undefined);
});

test('Discord imports remain deduplicated and background sync is throttled across refreshes', async () => {
  const stored = []; let syncedAt = null; let fetches = 0;
  const message = { id: 'message', channel_id: 'thread', timestamp: '2026-09-07T00:00:00Z', content: 'Reproduction details', author: { id: 'discord-user', username: 'Reporter' } };
  const db = {
    appSetting: { findUnique: async () => null, deleteMany: async () => {} },
    issue: { findUnique: async () => ({ id: 'issue', discordThreadId: 'thread', discordSyncedAt: syncedAt }), updateMany: async ({ data }) => { if (syncedAt) return { count: 0 }; syncedAt = data.discordSyncedAt; return { count: 1 }; } },
    account: { findUnique: async () => ({ user: { id: 'author' } }) },
    note: { findUnique: async ({where}) => stored.find(note => note.discordMessageId === where.discordMessageId), create: async ({ data }) => stored.push({ id: 'note', ...data }), update: async () => {} },
  };
  const load = loader({ 'src/lib/db': { db }, './discord-chat': { isOwnDiscordWebhook: async () => false }, './discord': { getDiscordChannelMessages: async () => { fetches++; return [message]; }, getDiscordChannelMessage: async () => message } });
  const { syncIssueNotesFromDiscord } = load('src/lib/discordSync.ts');
  await syncIssueNotesFromDiscord('issue'); await syncIssueNotesFromDiscord('issue');
  assert.equal(stored.length, 1); assert.equal(stored[0].discordMessageId, 'message'); assert.equal(fetches, 1);
});

test('Discord message requests carry a ten-second abort signal and fail safely', async (t) => {
  const previousToken = process.env.DISCORD_BOT_TOKEN;
  process.env.DISCORD_BOT_TOKEN = 'test-token';
  t.after(() => { if (previousToken === undefined) delete process.env.DISCORD_BOT_TOKEN; else process.env.DISCORD_BOT_TOKEN = previousToken; });
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (ms) => { timeouts.push(ms); return new AbortController().signal; });
  t.mock.method(global, 'fetch', async (_url, init) => { assert.ok(init.signal); throw new Error('timeout'); });
  const { getDiscordChannelMessages } = loader()('src/lib/discord.ts');
  assert.equal(await getDiscordChannelMessages('thread'), null);
  assert.deepEqual(timeouts, [10000]);
});
