/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Prisma } = require('@prisma/client');
const { loader, root } = require('./load-ts.cjs');
const { PGlite } = require('../../node_modules/.cache/issue-test-tools/node_modules/@electric-sql/pglite');

test('PostgreSQL integration: grouped queries, scope, pagination, migration and transaction rollback', async (t) => {
  const { postgresSchema } = loader()('src/lib/pg-schema.ts');
  const schema = postgresSchema();
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE SCHEMA IF NOT EXISTS "${schema}"; SET search_path TO "${schema}";
    CREATE TABLE "User" (id text PRIMARY KEY, name text, image text);
    CREATE TABLE "Issue" (id text PRIMARY KEY, "publicKey" text, title text, description text, status text DEFAULT 'OPEN', type text DEFAULT 'BUG', priority text DEFAULT 'MEDIUM', severity text DEFAULT 'MINOR', "assigneeId" text REFERENCES "User"(id) ON DELETE SET NULL, "dueDate" timestamp, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP, "resourceName" text, "storyPoints" integer, "parentIssueId" text REFERENCES "Issue"(id), "backlogRank" text, tags text);
    CREATE TABLE "IssueWatcher" ("issueId" text, "userId" text);
    CREATE TABLE "IssueActivity" (id serial PRIMARY KEY, "issueId" text, "actorId" text, action text, field text, "oldValue" text, "newValue" text);
    INSERT INTO "User" VALUES ('staff','Staff',NULL);
    INSERT INTO "Issue" (id, "publicKey",title,status,"updatedAt") SELECT 'p'||lpad(n::text,3,'0'), 'key'||n, 'Issue '||n, CASE WHEN n=1 THEN 'DONE' ELSE 'OPEN' END, '2026-09-07' FROM generate_series(1,102) n;
    INSERT INTO "Issue" (id,title,"parentIssueId",status,"assigneeId","updatedAt") SELECT 'c'||lpad(n::text,3,'0'), 'Child '||n, 'p001', CASE WHEN n=70 THEN 'DONE' ELSE 'OPEN' END, 'staff', '2026-09-07' FROM generate_series(1,70) n;
    INSERT INTO "IssueWatcher" VALUES ('c001','staff');`);
  await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20260907000000_issue_list_indexes/migration.sql'), 'utf8'));
  await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20261019000000_issue_assignees/migration.sql'), 'utf8'));
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM "IssueAssignee"')).rows[0].n, 70, 'Migration preserves every legacy assignment');
  let failAudit = false;
  let failNotifications = true;
  const notifications = [];
  function adapter(connection) {
    const query = async (strings, ...values) => {
      const statement = Array.isArray(strings) ? Prisma.sql(strings, ...values) : strings;
      return (await connection.query(statement.text, statement.values)).rows;
    };
    const getIssue = async (id) => {
      const rows = await connection.query('SELECT i.*, u.name AS "assigneeName", u.image AS "assigneeImage" FROM "Issue" i LEFT JOIN "User" u ON u.id=i."assigneeId" WHERE i.id=$1', [id]);
      const row = rows.rows[0];
      const assignees = (await connection.query('SELECT a."userId", jsonb_build_object(\'id\', u.id, \'name\', u.name, \'image\', u.image) AS "user" FROM "IssueAssignee" a JOIN "User" u ON u.id=a."userId" WHERE a."issueId"=$1 ORDER BY a."userId"', [id])).rows;
      return row ? { ...row, assignees } : null;
    };
    return { $queryRaw: query,
      issue: { findUnique: ({ where }) => getIssue(where.id), update: async ({ where, data }) => {
        const entries = Object.entries(data).filter(([key]) => key !== 'assignees');
        if (entries.length) await connection.query(`UPDATE "Issue" SET ${entries.map(([key], i) => `"${key}"=$${i+2}`).join(',')} WHERE id=$1`, [where.id, ...entries.map(([, v]) => v)]);
        if (data.assignees) {
          await connection.query('DELETE FROM "IssueAssignee" WHERE "issueId"=$1', [where.id]);
          for (const { userId } of data.assignees.create) await connection.query('INSERT INTO "IssueAssignee" ("issueId", "userId") VALUES ($1,$2)', [where.id, userId]);
        }
        return getIssue(where.id);
      } },
      user: { findMany: async ({ where }) => (await connection.query('SELECT * FROM "User" WHERE id=ANY($1::text[]) ORDER BY id', [where.id.in])).rows },
      issueActivity: { create: async ({ data }) => {
        if (failAudit) throw new Error('Simulated audit failure');
        const entries = Object.entries(data);
        await connection.query(`INSERT INTO "IssueActivity" (${entries.map(([k])=>`"${k}"`).join(',')}) VALUES (${entries.map((_, i)=>`$${i+1}`).join(',')})`, entries.map(([,v])=>v));
      } },
    };
  }
  const db = { ...adapter(pg), $transaction: (fn) => pg.transaction((tx) => fn(adapter(tx))), notification: { create: async ({ data }) => { if (failNotifications) throw new Error('Notifications offline'); notifications.push(data); } }, account: { findFirst: async () => null } };
  const load = loader({ 'src/lib/db': { db }, '@/lib/db': { db }, '@/lib/permissions': { canAssignIssues: (p) => !!p?.assign }, './activity': { recordActivity: async () => { throw new Error('Notifications offline'); } }, './discord-chat': { syncDiscordIssueStatus: async () => {} }, './discord': { getAppBaseUrl: () => 'http://localhost', sendDiscordDM: async () => {} }, './issue-backlog': { rankWhenEnteringBacklog: async () => 'a' } });
  const { getIssueListPage, getIssueChildren } = load('src/lib/issue-list.ts');
  const first = await getIssueListPage({}, 'all', null);
  assert.equal(first.groupCount, 102);
  assert.equal(first.matchingCount, 170);
  assert.equal(first.groups.length, 50);
  assert.equal(first.groups[0].parent.id, 'p001');
  assert.equal(first.groups[0].parent.matches, false);
  assert.equal(first.groups[0].children.length, 50);
  const rest = await getIssueChildren('p001', first.state, 'all', null, 50);
  assert.equal(rest.length, 19);
  assert.ok(rest.every((r) => r.status === 'OPEN'));
  const third = await getIssueListPage({ page: '999' }, 'all', null);
  assert.equal(third.state.page, 3);
  assert.equal(third.groups.length, 2);
  const second = await getIssueListPage({ page: '2' }, 'all', null);
  assert.equal(new Set([...first.groups, ...second.groups, ...third.groups].map((g) => g.parent.id)).size, 102);
  const watching = await getIssueListPage({}, 'watching', 'staff');
  assert.equal(watching.groupCount, 1);
  assert.equal(watching.matchingCount, 1);
  assert.equal(watching.groups[0].children[0].id, 'c001');
  assert.equal((await getIssueListPage({}, 'watching', 'other')).matchingCount, 0);
  assert.equal((await getIssueListPage({}, 'assigned', 'staff')).matchingCount, 70);
  assert.equal((await getIssueListPage({}, 'triage', null)).matchingCount, 101);
  assert.equal((await getIssueListPage({ q: "%' OR 1=1 --" }, 'all', null)).matchingCount, 0);
  await pg.exec(`UPDATE "Issue" SET priority='URGENT' WHERE id IN ('p002','c001');`);
  const urgent = await getIssueListPage({ priority: 'URGENT' }, 'all', null);
  assert.equal(urgent.matchingCount, 2); assert.equal(urgent.groupCount, 2);
  assert.ok(urgent.groups.flatMap(group => [group.parent, ...group.children]).filter(row => row.matches).every(row => row.priority === 'URGENT'));
  await pg.exec(`UPDATE "Issue" SET priority='MEDIUM' WHERE priority='URGENT';`);
  const { mutateIssue } = load('src/lib/issue-mutations.ts');
  const actor = { userId: 'staff', name: 'Staff', permissions: { assign: true } };
  const missingAssignee = await mutateIssue('p002', { status: 'REVIEW', assigneeId: 'missing' }, actor);
  assert.ok(missingAssignee.error);
  assert.equal((await db.issue.findUnique({ where: { id: 'p002' } })).status, 'OPEN');
  failAudit = true;
  const auditFailure = await mutateIssue('p002', { status: 'REVIEW', priority: 'HIGH' }, actor);
  assert.ok(auditFailure.error);
  assert.equal((await db.issue.findUnique({ where: { id: 'p002' } })).priority, 'MEDIUM');
  failAudit = false;
  const success = await mutateIssue('p002', { status: 'REVIEW', description: 'Reproduced', priority: 'HIGH' }, actor);
  assert.equal(success.issue.status, 'REVIEW');
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM "IssueActivity"')).rows[0].n, 3);
  await mutateIssue('p002', { status: 'REVIEW', description: 'Reproduced', priority: 'HIGH' }, actor);
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM "IssueActivity"')).rows[0].n, 3);
  const denied = await mutateIssue('p002', { status: 'DONE', assigneeId: 'staff' }, { ...actor, permissions: { assign: false } });
  assert.ok(denied.error);
  assert.equal((await db.issue.findUnique({ where: { id: 'p002' } })).status, 'REVIEW');
  await pg.exec(`INSERT INTO "User" VALUES ('helper','Helper',NULL), ('third','Third',NULL);`);
  failNotifications = false;
  const multiple = await mutateIssue('p002', { assigneeIds: ['helper', 'staff', 'helper'] }, actor);
  assert.equal(multiple.error, undefined);
  assert.deepEqual(multiple.issue.assignees.map(row => row.userId), ['helper', 'staff']);
  assert.deepEqual(notifications.map(row => row.userId), ['helper'], 'Only newly assigned people other than the actor are notified');
  assert.equal((await getIssueListPage({}, 'assigned', 'helper')).matchingCount, 1);
  assert.equal((await getIssueListPage({}, 'assigned', 'staff')).matchingCount, 71);
  const filtered = await getIssueListPage({ assignee: 'staff' }, 'all', null);
  assert.equal(filtered.matchingCount, 70);
  assert.equal(filtered.groups.find(group => group.parent.id === 'p002').parent.assignees.length, 2);
  const activity = (await pg.query(`SELECT * FROM "IssueActivity" WHERE action='ASSIGNEE_CHANGE' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.equal(activity.newValue, 'Helper, Staff');
  const countBefore = (await pg.query('SELECT COUNT(*)::int AS n FROM "IssueActivity"')).rows[0].n;
  await mutateIssue('p002', { assigneeIds: ['staff', 'helper'] }, actor);
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM "IssueActivity"')).rows[0].n, countBefore, 'Reordering is a no-op');
  assert.equal(notifications.length, 1);
  const deniedMultiple = await mutateIssue('p002', { assigneeIds: [] }, { ...actor, permissions: { assign: false } });
  assert.ok(deniedMultiple.error);
  const invalid = await mutateIssue('p002', { status: 'DONE', assigneeIds: ['missing', 'helper'] }, actor);
  assert.ok(invalid.error);
  assert.equal((await db.issue.findUnique({ where: { id: 'p002' } })).status, 'REVIEW');
  failAudit = true;
  const rollback = await mutateIssue('p002', { assigneeIds: ['third'] }, actor);
  assert.ok(rollback.error);
  assert.deepEqual((await db.issue.findUnique({ where: { id: 'p002' } })).assignees.map(row => row.userId), ['helper', 'staff']);
  failAudit = false;
  await mutateIssue('p002', { assigneeIds: ['helper', 'third'] }, actor);
  assert.deepEqual(notifications.map(row => row.userId), ['helper', 'third'], 'Existing assignees are not notified again');
  assert.equal((await getIssueListPage({}, 'assigned', 'staff')).matchingCount, 70);
  await mutateIssue('p002', { assigneeIds: [] }, actor);
  const cleared = await db.issue.findUnique({ where: { id: 'p002' } });
  assert.equal(cleared.assignees.length, 0);
  assert.equal(cleared.assigneeId, null);
  assert.equal((await getIssueListPage({ assignee: 'UNASSIGNED' }, 'all', null)).matchingCount, 101);
  await pg.exec(`DELETE FROM "User" WHERE id='staff';`);
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM "IssueAssignee"')).rows[0].n, 0, 'Deleting a user removes their assignments');
});
