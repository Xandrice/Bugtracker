/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loader, root } = require('../issues/load-ts.cjs');
const dates = loader()('src/lib/roadmap.ts');

test('Gantt sources include ranged board work and dated events, without expanding linked issues', () => {
  const milestone = { id: 'event', name: 'Launch', status: 'PLANNED', targetDate: '2026-11-02', issues: [{ id: 'linked-without-dates' }] };
  const task = { id: 'board', title: 'Board work', publicKey: null, status: 'OPEN', startDate: '2026-10-28', dueDate: '2026-11-03', categories: [] };
  const items = dates.ganttItems([milestone, { ...milestone, id: 'undated-event', targetDate: null }], [task, { ...task, id: 'no-start', startDate: null }, { ...task, id: 'no-end', dueDate: null }, { ...task, id: 'inverted', dueDate: '2026-10-01' }]);
  assert.deepEqual(items.map(item => item.id), ['board', 'event']);
  assert.equal(items[1].start, items[1].end);
  assert.equal(dates.daysBetween('2026-10-23', dates.addCalendarDays('2026-10-23', 27)), 27);
  assert.equal(dates.addCalendarDays('2026-03-07', 2), '2026-03-09');
  assert.equal(dates.addCalendarDays('2028-02-28', 2), '2028-03-01');
  assert.equal(dates.addCalendarDays('2026-12-30', 4), '2027-01-03');
  assert.equal(new Set(dates.CATEGORY_COLORS.map(color => color[1])).size, 20);
  assert.equal(dates.categoryTextColor('#FFFFFF'), '#000000');
  assert.equal(dates.categoryTextColor('#000000'), '#FFFFFF');
});

function harness() {
  const state = { signedIn: true, role: 'Developer', writes: [], invalidations: [], count: 1, categories: 1, fail: false };
  const record = op => async query => { if (state.fail) throw Error('Database unavailable'); state.writes.push({ op, query }); return { count: state.count }; };
  const db = {
    scheduleCategory: { count: async () => state.categories, create: record('category-create'), update: record('category-update'), delete: record('category-delete') },
    $queryRaw: async () => [],
    issue: { findUniqueOrThrow: async () => ({ startDate: null, dueDate: null, categories: [] }), update: async query => { await record('task-update')(query); return { categories: [{ name: 'Engineering' }] }; }, updateMany: record('task-move') },
    release: { updateMany: record('event-move') },
    issueActivity: { create: record('audit') },
    $transaction: async fn => fn(db),
  };
  const actions = loader({
    '@/../auth': { auth: async () => state.signedIn ? { user: { id: 'staff' } } : null }, '@/lib/db': { db },
    '@/lib/permissions': { getPermissionContext: async () => ({ role: state.role }), canEditIssues: context => !!context, canManageRoadmap: context => ['Developer', 'Admin', 'Owner'].includes(context.role) },
    'next/cache': { revalidatePath: path => state.invalidations.push(path) },
  })('src/app/roadmap/schedule-actions.ts');
  const form = input => { const data = new FormData(); for (const [key, value] of Object.entries(input)) data.append(key, value); return data; };
  const move = { kind: 'ISSUE', id: 'task', start: '2026-10-25', end: '2026-10-28', previousStart: '2026-10-24', previousEnd: '2026-10-27' };
  return { state, actions, form, move };
}

test('category CRUD validates custom colors, permissions, and duplicate names', async () => {
  const { state, actions, form } = harness();
  for (const input of [{ id: '', name: '', color: '#123456' }, { id: '', name: 'a'.repeat(61), color: '#123456' }, { id: '', name: 'Team', color: 'red' }, { id: '', name: 'Team', color: '#12345g' }]) assert.ok((await actions.saveScheduleCategory(form(input))).error);
  assert.equal(state.writes.length, 0);
  assert.deepEqual(await actions.saveScheduleCategory(form({ id: '', name: ' Team ', color: '#a1b2c3' })), { ok: true });
  assert.deepEqual(state.writes[0].query.data, { name: 'Team', color: '#A1B2C3' });
  await actions.saveScheduleCategory(form({ id: 'team', name: 'Renamed', color: '#000000' }));
  assert.equal(state.writes[1].op, 'category-update');
  await actions.deleteScheduleCategory('team');
  assert.equal(state.writes[2].op, 'category-delete');
  state.fail = true;
  assert.ok((await actions.saveScheduleCategory(form({ id: '', name: 'Team', color: '#123456' }))).error);
  state.role = 'Member';
  assert.ok((await actions.saveScheduleCategory(form({ id: '', name: 'Team', color: '#123456' }))).error);
  assert.ok((await actions.deleteScheduleCategory('team')).error);
  assert.equal(state.writes.length, 3);
});

test('task schedules validate ranges and categories and persist tags with an audit', async () => {
  const { state, actions, form } = harness();
  const input = { id: 'task', startDate: '2026-10-24', dueDate: '2026-10-28', categoryId: 'team' };
  for (const changes of [{ dueDate: '2026-10-23' }, { startDate: '2026-02-30' }, { dueDate: '' }, { categoryId: '' }]) assert.ok((await actions.saveTaskSchedule(form({ ...input, ...changes }))).error);
  state.categories = 0;
  assert.ok((await actions.saveTaskSchedule(form(input))).error);
  assert.equal(state.writes.length, 0);
  state.categories = 1;
  assert.deepEqual(await actions.saveTaskSchedule(form(input)), { ok: true });
  assert.equal(state.writes[0].query.data.startDate.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.deepEqual(state.writes[0].query.data.categories, { set: [{ id: 'team' }] });
  assert.equal(state.writes[1].op, 'audit');
  state.signedIn = false;
  assert.ok((await actions.saveTaskSchedule(form(input))).error);
});

test('drag saves compare original dates atomically, protect permissions, and report failed writes', async () => {
  const { state, actions, move } = harness();
  assert.deepEqual(await actions.moveScheduleItem(move), { ok: true });
  assert.equal(state.writes[0].op, 'task-move');
  assert.equal(state.writes[0].query.where.startDate.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(state.writes[0].query.where.dueDate.toISOString(), '2026-10-27T00:00:00.000Z');
  assert.equal(state.writes[1].op, 'audit');
  assert.ok(state.invalidations.includes('/issues/task'));
  state.writes = []; state.invalidations = []; state.count = 0;
  assert.match((await actions.moveScheduleItem(move)).error, /changed or was removed/);
  assert.equal(state.writes.length, 1); assert.equal(state.invalidations.length, 0);
  state.writes = []; state.count = 1;
  for (const change of [{ end: '2026-10-01' }, { start: '2026-02-30' }, { previousStart: '' }, { kind: 'OTHER' }]) assert.ok((await actions.moveScheduleItem({ ...move, ...change })).error);
  assert.equal(state.writes.length, 0);
  state.role = 'Member';
  assert.ok((await actions.moveScheduleItem({ ...move, kind: 'RELEASE' })).error);
  assert.deepEqual(await actions.moveScheduleItem(move), { ok: true }, 'Signed-in issue editors can move board tasks');
  state.role = 'Developer'; state.writes = [];
  assert.deepEqual(await actions.moveScheduleItem({ ...move, kind: 'RELEASE', previousStart: null }), { ok: true });
  assert.equal(state.writes[0].query.where.startDate, null);
  state.fail = true;
  assert.ok((await actions.moveScheduleItem(move)).error);
  state.signedIn = false;
  assert.ok((await actions.moveScheduleItem(move)).error);
});

test('PostgreSQL migration preserves existing records and safely removes only category tags', async t => {
  const { PGlite } = require('../../node_modules/.cache/issue-test-tools/node_modules/@electric-sql/pglite');
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(`CREATE TABLE "Issue" (id text PRIMARY KEY, "dueDate" timestamp);
    CREATE TABLE "Release" (id text PRIMARY KEY, "targetDate" timestamp);
    INSERT INTO "Issue" VALUES ('task', '2026-10-28'); INSERT INTO "Release" VALUES ('event', '2026-11-02');`);
  await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20261024000000_schedule_categories/migration.sql'), 'utf8'));
  await pg.exec(`INSERT INTO "ScheduleCategory" VALUES ('team', 'Engineering', '#123456');
    INSERT INTO "_IssueToScheduleCategory" VALUES ('task', 'team');
    INSERT INTO "_ReleaseToScheduleCategory" VALUES ('event', 'team');
    UPDATE "Issue" SET "startDate" = '2026-10-24' WHERE id = 'task';`);
  await assert.rejects(pg.exec(`UPDATE "Issue" SET "startDate" = '2026-10-29' WHERE id = 'task'`), /Issue_schedule_range_check/);
  await pg.exec(`DELETE FROM "ScheduleCategory" WHERE id = 'team'`);
  for (const table of ['_IssueToScheduleCategory', '_ReleaseToScheduleCategory']) assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)).rows[0].n, 0);
  for (const table of ['Issue', 'Release']) assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)).rows[0].n, 1);
  assert.equal((await pg.query(`SELECT "startDate"::text AS "startDate" FROM "Issue"`)).rows[0].startDate, '2026-10-24 00:00:00');
});
