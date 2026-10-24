/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('../issues/load-ts.cjs');
const dates = loader()('src/lib/roadmap.ts');

test('calendar dates survive leap years, month boundaries, and timezone changes', () => {
  for (const value of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-2-03', '2026-10-23T00:00:00Z', '1899-12-31', '']) assert.equal(dates.parseRoadmapDate(value), null, value);
  assert.equal(dates.parseRoadmapDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
  const march = dates.calendarDays('2026-03');
  assert.equal(march.length, 35);
  assert.equal(march[0], '2026-03-01');
  assert.equal(march.at(-1), '2026-04-04');
  const feb = dates.calendarDays('2028-02');
  assert.equal(feb.length % 7, 0);
  assert.ok(feb.includes('2028-02-29'));
  assert.equal(new Set(feb).size, feb.length);
  assert.equal(dates.moveMonth('2026-12', 1), '2027-01');
  assert.equal(dates.moveMonth('2026-01', -1), '2025-12');
  assert.equal(dates.moveMonth('1900-01', -1), '1900-01');
  assert.equal(dates.formatRoadmapDate('2026-03-08'), 'Mar 8, 2026');
  assert.deepEqual(dates.calendarDays('invalid'), []);
});

function harness() {
  const state = { userId: 'staff', role: 'Developer', writes: [], invalidations: [], issueCount: 2, fail: false };
  const db = {
    issue: { count: async () => state.issueCount, findMany: async (query) => { state.search = query; return []; } },
    release: Object.fromEntries(['create', 'update', 'delete'].map((op) => [op, async (query) => { if (state.fail) throw new Error('DB failure'); state.writes.push({ op, query }); }])),
    $transaction: async (fn) => fn(db),
  };
  const load = loader({ '@/../auth': { auth: async () => state.userId ? { user: { id: state.userId } } : null }, '@/lib/db': { db },
    'next/cache': { revalidatePath: (path) => state.invalidations.push(path) } });
  const permissions = load('src/lib/permissions.ts');
  // Exercise the real role predicate without contacting the app's configured DB.
  const actions = loader({ '@/../auth': { auth: async () => state.userId ? { user: { id: state.userId } } : null }, '@/lib/db': { db },
    '@/lib/permissions': { canManageRoadmap: permissions.canManageRoadmap, getPermissionContext: async () => ({ userId: state.userId, role: state.role }) },
    'next/cache': { revalidatePath: (path) => state.invalidations.push(path) },
  })('src/app/roadmap/actions.ts');
  function form(changes = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ id: '', name: ' Economy update ', description: ' Details ', status: 'PLANNED', targetDate: '2026-10-30', ...changes })) data.set(key, value);
    return data;
  }
  return { state, actions, form, permissions };
}

test('only owners, admins, and developers can mutate or search the roadmap', async () => {
  const { state, actions, form, permissions } = harness();
  for (const role of ['Owner', 'Admin', 'Developer', 'Moderator', 'Member', null]) {
    state.role = role;
    assert.equal(permissions.canManageRoadmap({ role }), ['Owner', 'Admin', 'Developer'].includes(role));
  }
  for (const role of ['Moderator', 'Member', null]) {
    state.role = role;
    assert.ok((await actions.saveRoadmapMilestone(form())).error);
    assert.ok((await actions.deleteRoadmapMilestone('release')).error);
    assert.ok((await actions.searchRoadmapIssues('key')).error);
  }
  state.userId = null;
  assert.ok((await actions.saveRoadmapMilestone(form())).error);
  assert.equal(state.writes.length, 0);
});

test('validates fields before writing and preserves linked issues on failures', async () => {
  const { state, actions, form } = harness();
  for (const change of [{ name: '  ' }, { name: 'a'.repeat(201) }, { description: 'a'.repeat(10001) }, { status: 'INVALID' }, { targetDate: '2026-02-30' }]) assert.ok((await actions.saveRoadmapMilestone(form(change))).error);
  const missing = form(); missing.append('issueId', 'missing'); state.issueCount = 0;
  assert.ok((await actions.saveRoadmapMilestone(missing)).error);
  const tooMany = form(); for (let n = 0; n < 101; n++) tooMany.append('issueId', String(n));
  assert.ok((await actions.saveRoadmapMilestone(tooMany)).error);
  assert.equal(state.writes.length, 0);
  assert.equal(state.invalidations.length, 0);
});

test('creates, reschedules, unlinks, completes, and deletes persisted milestones', async () => {
  const { state, actions, form } = harness();
  const data = form(); data.append('issueId', 'a'); data.append('issueId', 'b'); data.append('issueId', 'a');
  assert.deepEqual(await actions.saveRoadmapMilestone(data), { ok: true });
  const created = state.writes[0].query.data;
  assert.equal(created.name, 'Economy update');
  assert.equal(created.authorId, 'staff');
  assert.equal(created.targetDate.toISOString(), '2026-10-30T00:00:00.000Z');
  assert.deepEqual(created.issues.create, [{ issueId: 'a' }, { issueId: 'b' }]);
  assert.deepEqual(await actions.saveRoadmapMilestone(form({ id: 'existing', targetDate: '', status: 'RELEASED' })), { ok: true });
  const updated = state.writes[1].query;
  assert.deepEqual(updated.where, { id: 'existing' });
  assert.equal(updated.data.targetDate, null);
  assert.equal(updated.data.status, 'RELEASED');
  assert.deepEqual(updated.data.issues, { deleteMany: {}, create: [] });
  assert.equal(updated.data.authorId, undefined);
  assert.deepEqual(await actions.deleteRoadmapMilestone('existing'), { ok: true });
  assert.equal(state.writes[2].op, 'delete');
  assert.deepEqual(state.invalidations, ['/roadmap', '/roadmap', '/roadmap']);
  state.fail = true;
  assert.ok((await actions.saveRoadmapMilestone(form())).error);
  assert.ok((await actions.deleteRoadmapMilestone('existing')).error);
  assert.equal(state.invalidations.length, 3);
});

test('issue search is bounded and searches titles and keys', async () => {
  const { state, actions } = harness();
  await actions.searchRoadmapIssues(' ECO ');
  assert.equal(state.search.take, 20);
  assert.equal(state.search.where.OR[0].title.contains, 'ECO');
  assert.equal(state.search.where.OR[1].publicKey.contains, 'ECO');
  assert.ok((await actions.searchRoadmapIssues('a'.repeat(201))).error);
});
