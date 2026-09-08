/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Prisma } = require('@prisma/client');
const { loader, root } = require('./load-ts.cjs');
const { PGlite } = require('../../node_modules/.cache/issue-test-tools/node_modules/@electric-sql/pglite');

test('PostgreSQL integration: grouped queries, scope, pagination, migration and transaction rollback', async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE TABLE "User" (id text PRIMARY KEY, name text, image text);
    CREATE TABLE "Issue" (id text PRIMARY KEY, "publicKey" text, title text, description text, status text DEFAULT 'OPEN', type text DEFAULT 'BUG', priority text DEFAULT 'MEDIUM', severity text DEFAULT 'MINOR', "assigneeId" text REFERENCES "User"(id), "dueDate" timestamp, "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP, "resourceName" text, "storyPoints" integer, "parentIssueId" text REFERENCES "Issue"(id), "backlogRank" text, tags text);
    CREATE TABLE "IssueWatcher" ("issueId" text, "userId" text);
    CREATE TABLE "IssueActivity" (id serial PRIMARY KEY, "issueId" text, "actorId" text, action text, field text, "oldValue" text, "newValue" text);
    INSERT INTO "User" VALUES ('staff','Staff',NULL);
    INSERT INTO "Issue" (id, "publicKey",title,status,"updatedAt") SELECT 'p'||lpad(n::text,3,'0'), 'key'||n, 'Issue '||n, CASE WHEN n=1 THEN 'DONE' ELSE 'OPEN' END, '2026-09-07' FROM generate_series(1,102) n;
    INSERT INTO "Issue" (id,title,"parentIssueId",status,"assigneeId","updatedAt") SELECT 'c'||lpad(n::text,3,'0'), 'Child '||n, 'p001', CASE WHEN n=70 THEN 'DONE' ELSE 'OPEN' END, 'staff', '2026-09-07' FROM generate_series(1,70) n;
    INSERT INTO "IssueWatcher" VALUES ('c001','staff');`);
  await pg.exec(fs.readFileSync(path.join(root, 'prisma/migrations/20260907000000_issue_list_indexes/migration.sql'), 'utf8'));
  let failAudit = false;
  function adapter(connection) {
    const query = async (strings, ...values) => {
      const statement = Array.isArray(strings) ? Prisma.sql(strings, ...values) : strings;
      return (await connection.query(statement.text, statement.values)).rows;
    };
    const getIssue = async (id) => {
      const rows = await connection.query('SELECT i.*, u.name AS "assigneeName", u.image AS "assigneeImage" FROM "Issue" i LEFT JOIN "User" u ON u.id=i."assigneeId" WHERE i.id=$1', [id]);
      const row = rows.rows[0];
      return row ? { ...row, assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName, image: row.assigneeImage } : null } : null;
    };
    return { $queryRaw: query,
      issue: { findUnique: ({ where }) => getIssue(where.id), update: async ({ where, data }) => {
        const entries = Object.entries(data);
        await connection.query(`UPDATE "Issue" SET ${entries.map(([key], i) => `"${key}"=$${i+2}`).join(',')} WHERE id=$1`, [where.id, ...entries.map(([, v]) => v)]);
        return getIssue(where.id);
      } },
      user: { findUnique: async ({ where }) => (await connection.query('SELECT * FROM "User" WHERE id=$1', [where.id])).rows[0] },
      issueActivity: { create: async ({ data }) => {
        if (failAudit) throw new Error('Simulated audit failure');
        const entries = Object.entries(data);
        await connection.query(`INSERT INTO "IssueActivity" (${entries.map(([k])=>`"${k}"`).join(',')}) VALUES (${entries.map((_, i)=>`$${i+1}`).join(',')})`, entries.map(([,v])=>v));
      } },
    };
  }
  const db = { ...adapter(pg), $transaction: (fn) => pg.transaction((tx) => fn(adapter(tx))), notification: { create: async () => { throw new Error('Notifications offline'); } }, account: { findFirst: async () => null } };
  const load = loader({ 'src/lib/db': { db }, '@/lib/db': { db }, '@/lib/permissions': { canAssignIssues: (p) => !!p?.assign }, './activity': { recordActivity: async () => { throw new Error('Notifications offline'); } }, './discord': { getAppBaseUrl: () => 'http://localhost', sendDiscordDM: async () => {} }, './issue-backlog': { rankWhenEnteringBacklog: async () => 'a' } });
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
});
