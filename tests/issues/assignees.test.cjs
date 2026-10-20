/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

test('the Kanban personal filter includes secondary assignees and assigned children under other owners', async () => {
  const people = ids => ids.map(id => ({ userId: id, user: { id, name: id, image: null } }));
  const rows = [
    { id: 'shared', parentIssueId: null, assigneeId: 'owner', assignees: people(['owner', 'staff']) },
    { id: 'other', parentIssueId: null, assigneeId: 'owner', assignees: people(['owner']) },
    { id: 'child', parentIssueId: 'other', assigneeId: 'owner', assignees: people(['owner', 'staff']) },
  ].map(row => ({ ...row, publicKey: row.id, title: row.id, status: 'OPEN', priority: 'MEDIUM', type: 'TASK' }));
  const matches = (row, where) => !where.assignees || row.assignees.some(assignment => assignment.userId === where.assignees.some.userId);
  const page = loader({
    '@/../auth': { auth: async () => ({ user: { id: 'staff' } }) },
    '@/lib/db': { db: { issue: { findMany: async ({ where, select }) => rows.filter(row => matches(row, where)).map(row => ({
      ...row, parentIssue: rows.find(parent => parent.id === row.parentIssueId), subtasks: rows.filter(child => child.parentIssueId === row.id && matches(child, select.subtasks.where)),
    })) } } },
    'next/link': { default: 'a', __esModule: true },
    './MainKanbanBoard': { MainKanbanBoard: 'board' }, './BoardNewIssueButton': { BoardNewIssueButton: 'new-issue' },
    '@/components/ui/PageHeader': { PageContainer: 'main', PageHeader: 'header' },
  })('src/app/boards/main/page.tsx').default;
  const tree = await page({ searchParams: Promise.resolve({ assignee: 'me' }) });
  const board = tree.props.children.find(child => child?.type === 'board');
  assert.deepEqual(board.props.issues.map(issue => issue.id), ['shared', 'child']);
  assert.equal(board.props.issues[0].assignees.length, 2);
  assert.equal(board.props.issues[1].orphanParentRef, 'other');
  const all = await page({ searchParams: Promise.resolve({}) });
  const allBoard = all.props.children.find(child => child?.type === 'board');
  assert.equal(allBoard.props.issues.length, 3);
  assert.equal(allBoard.props.issues.find(issue => issue.id === 'other').subtasks[0].assignees.length, 2);
});

test('status changes notify every assignee and deduplicate reporter, watcher, and actor overlaps', async () => {
  const notified = [];
  const db = {
    issue: { findUnique: async () => ({ title: 'Shared task', publicKey: 'task', reporterId: 'first', assignees: [{ userId: 'first' }, { userId: 'second' }, { userId: 'actor' }] }) },
    notification: { create: async ({ data }) => notified.push(data.userId) },
    account: { findFirst: async () => null },
  };
  const { recordActivity } = loader({
    '@/lib/db': { db }, '@/lib/discord': { getAppBaseUrl: () => 'https://tracker.example' },
    '@/lib/issue-watchers': { ...loader()('src/lib/issue-watchers.ts'), getIssueWatcherUserIds: async () => ['second', 'watcher'] },
  })('src/lib/activity.ts');
  await recordActivity({ issueId: 'task', actorId: 'actor', action: 'STATUS_CHANGE', field: 'status', oldValue: 'OPEN', newValue: 'DONE', notifyStatusChange: true, activityAlreadyRecorded: true });
  assert.deepEqual(notified, ['first', 'second', 'watcher']);
});

test('comments notify all assignees once; internal comments do not send Discord DMs', async () => {
  const notified = []; const dms = [];
  const db = {
    issue: { findUnique: async () => ({ title: 'Shared task', publicKey: 'task', discordThreadId: null, assignees: [{ userId: 'first' }, { userId: 'second' }, { userId: 'actor' }] }) },
    note: { create: async () => ({ id: 'note' }) },
    notification: { create: async ({ data }) => notified.push(data.userId) },
    account: { findFirst: async ({ where }) => ({ providerAccountId: where.userId }) },
  };
  const { createTeamNote } = loader({
    '@/../auth': { auth: async () => ({ user: { id: 'actor', name: 'Actor' } }) },
    '@/lib/db': { db }, '@/lib/permissions': {}, '@/lib/staff': {}, '@/lib/member-profiles': {}, '@/lib/activity': {}, '@/lib/issue-backlog': {},
    '@/lib/discord': { getAppBaseUrl: () => 'https://tracker.example', sendDiscordDM: async id => dms.push(id) },
    '@/lib/issue-watchers': { ...loader()('src/lib/issue-watchers.ts'), getIssueWatcherUserIds: async () => ['second', 'watcher'] },
    'next/cache': { revalidatePath: () => {} },
  })('src/app/actions.ts');
  const form = new FormData(); form.set('issueId', 'task'); form.set('content', 'A shared update');
  await createTeamNote(form);
  assert.deepEqual(notified, ['first', 'second', 'watcher']);
  assert.deepEqual(dms, ['first', 'second', 'watcher']);
  notified.length = 0; dms.length = 0; form.set('internal', 'true');
  await createTeamNote(form);
  assert.deepEqual(notified, ['first', 'second', 'watcher']);
  assert.deepEqual(dms, []);
});
