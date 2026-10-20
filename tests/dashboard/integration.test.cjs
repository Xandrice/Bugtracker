/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loader, root } = require('../issues/load-ts.cjs');
const { PGlite } = require('../../node_modules/.cache/issue-test-tools/node_modules/@electric-sql/pglite');

test('Discord migration preserves existing comments without queuing historic sends', async t => {
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(`CREATE TABLE "Issue" (id text PRIMARY KEY); CREATE TABLE "Note" (id text PRIMARY KEY, "issueId" text, "createdAt" timestamp, content text); INSERT INTO "Issue" VALUES ('issue'); INSERT INTO "Note" VALUES ('existing','issue',NOW(),'Historic comment');`);
  await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20261004000000_discord_two_way/migration.sql'), 'utf8'));
  const note = (await pg.query('SELECT * FROM "Note"')).rows[0];
  assert.equal(note.content, 'Historic comment'); assert.equal(note.internal, false); assert.equal(note.discordSyncStatus, 'NONE'); assert.equal(note.discordDelivery, null);
});

function deliveryFixture() {
  const note = { id: 'note', content: 'x'.repeat(4100), source: 'APP', internal: false, discordSyncStatus: 'PENDING', updatedAt: new Date(), author: { name: 'Staff', image: null }, issue: { id: 'issue', discordThreadId: 'thread', discordChannelId: 'forum', status: 'OPEN' }, discordDelivery: null, discordMessageId: null };
  const sent = []; const edited = []; const deleted = []; let failSecond = true;
  const db = { note: {
    updateMany: async ({ where, data }) => { if (where.discordSyncStatus === undefined && where.OR) { if (note.internal || note.source !== 'APP' || !['PENDING','FAILED'].includes(note.discordSyncStatus)) return { count: 0 }; } Object.assign(note, data); return { count: 1 }; },
    findUnique: async () => note, update: async ({data}) => Object.assign(note, data),
  }, issue: { update: async () => {} }, appSetting: { findUnique: async ({ where }) => where.key.startsWith('discord.webhook.') ? { value: JSON.stringify({ id: 'webhook', token: 'test-secret' }) } : null }, account: { findMany: async () => [] }, projectMember: { findMany: async () => [] } };
  const load = loader({ 'src/lib/db': { db }, './discord': {
    readDiscordChannel: async () => ({ parent_id: 'forum' }),
    sendWebhookMessage: async (_hook,_thread,payload) => { if (failSecond && sent.length === 1) throw new Error('Transient failure'); const id = `sent-${sent.length}`; sent.push({id,payload}); return {id}; },
    editWebhookMessage: async (_hook,_thread,id,payload) => edited.push({id,payload}), deleteWebhookMessage: async (_hook,_thread,id) => deleted.push(id),
  } });
  return { note, sent, edited, deleted, resume: () => { failSecond = false; }, deliver: load('src/lib/discord-chat.ts').deliverIssueComment };
}
test('partial sends persist IDs, retries resume, edits shorten the mirrored reply, and internal notes never send', async () => {
  const f = deliveryFixture(); await f.deliver('note');
  assert.equal(f.note.discordSyncStatus, 'FAILED'); assert.equal(f.sent.length, 1); assert.equal(f.note.discordMessageId, 'sent-0');
  f.resume(); await f.deliver('note'); assert.equal(f.note.discordSyncStatus, 'SENT'); assert.equal(f.sent.length, 3); assert.equal(f.note.discordDelivery.parts.length, 3); assert.ok(f.edited.some(item => item.id === 'sent-0'));
  assert.ok(f.sent.every(item => item.payload.content.length <= 2000));
  f.note.content = 'Edited reply'; f.note.discordSyncStatus = 'PENDING'; await f.deliver('note'); assert.equal(f.sent.length, 3); assert.equal(f.note.discordDelivery.parts.length, 1); assert.equal(f.deleted.length, 2);
  f.note.internal = true; f.note.discordSyncStatus = 'PENDING'; await f.deliver('note'); assert.equal(f.sent.length, 3);
});
test('concurrent deliveries acquire one claim and cannot duplicate messages', async () => {
  const f = deliveryFixture(); f.resume(); await Promise.all([f.deliver('note'), f.deliver('note')]);
  assert.equal(f.sent.length, 3); assert.equal(f.note.discordSyncStatus, 'SENT');
});

test('guided server actions deny raw queries and tenants, hide sensitive data, and retain player lock in Advanced', async () => {
  const calls = [];
  const permissions = { role: 'Moderator', staffPermissions: { logs: { view: true, advanced: false }, players: { view: true } } };
  const load = loader({ 'server-only': {}, 'src/lib/db': { db: {} }, './fivem-db': { getStaffPlayerLogIdentity: async id => ({ citizenid: id, license: 'license:secret', discord: '123' }) }, './victorialogs': {
    queryVictoriaLogs: async input => { calls.push(input); return { entries: [{ _time: '2026-10-04T00:00:00Z', _msg: 'connect 192.0.2.1', ip: '192.0.2.1', license: 'secret', resource: 'connections', event: 'connect' }], error: null, debug: { endpoint: 'http://private-host' } }; },
    victoriaLogHits: async () => ({ data: {hits: []} }), victoriaLogFacets: async () => ({ data: {facets: []} }), victoriaLogFieldValues: async () => ({ data: {values: []} }),
  } });
  const { searchLogs, prepareLogSearch, entriesCsv } = load('src/lib/log-service.ts');
  await assert.rejects(searchLogs({ mode: 'advanced', raw: '*' }, permissions), /Advanced/); await assert.rejects(searchLogs({ accountId: '1' }, permissions), /Advanced/); assert.equal(calls.length, 0);
  const guided = await searchLogs({ player: '82258' }, permissions); assert.equal(guided.debug, null); assert.equal(guided.entries[0].ip, undefined); assert.equal(guided.entries[0].license, undefined); assert.ok(!guided.entries[0]._msg.includes('192.0.2.1')); assert.ok(calls[0].hiddenFields.includes('ip'));
  const locked = await prepareLogSearch({ mode: 'advanced', raw: '* | union(*)', player: 'another' }, { ...permissions, staffPermissions: { ...permissions.staffPermissions, logs: { view: true, advanced: true } } }, '82258');
  assert.ok(locked.input.extraFilterQueries[0].includes('82258')); assert.ok(!locked.input.extraFilterQueries[0].includes('another'));
  assert.ok(entriesCsv([{ _msg: '=WEBSERVICE("secret")' }]).includes("'=WEBSERVICE"));
});
test('production cron refuses scans when its secret is missing', async t => {
  const oldNode = process.env.NODE_ENV; const oldSecret = process.env.CRON_SECRET;
  process.env.NODE_ENV = 'production'; delete process.env.CRON_SECRET;
  t.after(() => { process.env.NODE_ENV = oldNode; if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret; });
  let scans = 0;
  const { GET } = loader({ '@/lib/staff-snapshots': { captureMetricSnapshot: async () => { scans++; return {ok:true}; } } })('src/app/api/staff-tools/snapshot/route.ts');
  assert.equal((await GET(new Request('http://localhost/api/staff-tools/snapshot'))).status, 503); assert.equal(scans, 0);
});
