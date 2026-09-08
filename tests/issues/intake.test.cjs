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

test('comments are read after sync and stored comments survive sync failures', async () => {
  const events = [];
  const stored = [];
  let fail = false;
  const load = loader({ 'src/lib/db': { db: { note: { findMany: async () => { events.push('read'); return stored; } } } }, './discordSync': {
    syncIssueNotesFromDiscord: async () => { events.push('sync'); if (fail) throw new Error('offline'); stored.push({ id: 'new-comment' }); return { reason: 'ok' }; },
  } });
  const { loadIssueComments } = load('src/lib/issue-comments.ts');
  assert.equal((await loadIssueComments('issue')).notes[0].id, 'new-comment');
  assert.deepEqual(events, ['sync', 'read']);
  fail = true;
  const result = await loadIssueComments('issue');
  assert.equal(result.notes.length, 1);
  assert.equal(result.syncWarning, true);
});

test('Discord imports remain deduplicated across repeated refreshes', async () => {
  const stored = [];
  const message = { id: 'message', timestamp: '2026-09-07T00:00:00Z', content: 'Reproduction details', author: { id: 'discord-user', username: 'Reporter' } };
  const db = {
    issue: { findUnique: async () => ({ id: 'issue', discordThreadId: 'thread' }) },
    account: { findUnique: async () => ({ user: { id: 'author' } }) },
    user: { update: async () => ({ id: 'author' }) },
    note: { findMany: async ({ where }) => where.content ? [] : stored, create: async ({ data }) => stored.push({ id: 'note', ...data }), update: async () => {} },
  };
  const load = loader({ 'src/lib/db': { db }, '@/lib/discord': { getDiscordChannelMessages: async () => [message], getDiscordChannelMessage: async () => message } });
  const { syncIssueNotesFromDiscord } = load('src/lib/discordSync.ts');
  await syncIssueNotesFromDiscord('issue');
  await syncIssueNotesFromDiscord('issue');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].discordMessageId, 'message');
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
