/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const load = loader();
const { validateIssueFields, issueFieldChanges } = load('src/lib/issue-validation.ts');
const { mergeIssueTemplate } = load('src/lib/issue-draft.ts');
const { parseIssueListState, issueListSearchParams } = load('src/lib/issue-list-state.ts');
const { refreshIssueGroups, retainMatchingSelection } = load('src/lib/issue-list-refresh.ts');

test('creation and editing validate types, dates, enum values, and estimates', () => {
  for (const input of [{ title: ' ' }, { title: {} }, { status: 'wrong' }, { priority: null }, { severity: [] }, { type: 'MISSING' }, { description: 3 }, { dueDate: '2026-02-30' }, { dueDate: 'yesterday' }, { storyPoints: '3abc' }, { storyPoints: -1 }, { storyPoints: 1.5 }, { storyPoints: 2147483648 }]) {
    assert.ok(Object.keys(validateIssueFields(input).fieldErrors).length, JSON.stringify(input));
  }
  assert.ok(validateIssueFields({}, true).fieldErrors.title);
  const valid = validateIssueFields({ title: ' Report ', dueDate: '2024-02-29', storyPoints: '0', description: '', tags: null });
  assert.deepEqual(valid.fieldErrors, {});
  assert.equal(valid.data.title, 'Report');
  assert.equal(valid.data.dueDate.toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(valid.data.storyPoints, 0);
  assert.equal(valid.data.description, null);
  assert.deepEqual(validateIssueFields({ dueDate: '', storyPoints: '' }).data, { dueDate: null, storyPoints: null });
});

test('template switches retain edited fields and unrelated fields; replacement is explicit', () => {
  const original = { title: 'My title', description: 'Original body', type: 'BUG', tags: 'police' };
  const template = { title: 'New title', description: 'New body', type: 'TASK' };
  const dirty = new Set(['title']);
  assert.deepEqual(mergeIssueTemplate(original, template, dirty), { title: 'My title', description: 'New body', type: 'TASK', tags: 'police' });
  assert.deepEqual(mergeIssueTemplate(original, template, dirty, true), { ...original, ...template });
  assert.equal(original.title, 'My title');
});

test('list URLs preserve filters and watching scope, and reject invalid pagination/sort', () => {
  const state = parseIssueListState({ q: 'police', page: '2', assignee: 'staff', sort: 'priority', direction: 'asc' }, 'watching');
  const params = issueListSearchParams(state, 'watching');
  assert.equal(params.get('view'), 'watching');
  assert.deepEqual(parseIssueListState(Object.fromEntries(params), 'watching'), state);
  assert.equal(parseIssueListState({}, 'all').status, 'ACTIVE');
  assert.equal(parseIssueListState({ page: '-1', sort: 'id; DROP TABLE', status: 'bad' }, 'all').sort, 'updatedAt');
  assert.equal(parseIssueListState({ page: 'NaN' }, 'all').page, 1);
});

test('refresh reloads expanded child batches and retains only failed matching selections', async () => {
  const oldRows = Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, matches: true, status: 'OPEN' }));
  const parent = { id: 'p', childCount: 60, matches: false };
  const calls = [];
  const groups = await refreshIssueGroups([{ parent, expanded: true, children: oldRows }], [{ parent, expanded: false, children: [] }], async (id, offset) => {
    calls.push([id, offset]);
    return oldRows.slice(offset, offset + 50).map((row) => ({ ...row, status: 'REVIEW' }));
  });
  assert.deepEqual(calls, [['p', 0], ['p', 50]]);
  assert.equal(groups[0].expanded, true);
  assert.equal(groups[0].children[55].status, 'REVIEW');
  assert.deepEqual(retainMatchingSelection(['p', 'c55', 'deleted'], groups), ['c55']);
  await assert.rejects(refreshIssueGroups(groups, groups, async () => { throw new Error('offline'); }), /offline/);
});

test('audit changes include narrative, dates, priority and null clears, but exclude no-ops', () => {
  const changes = issueFieldChanges({ title: 'Same', description: 'old', priority: 'LOW', dueDate: new Date('2026-09-07'), tags: 'tag' }, { title: 'Same', description: 'new', priority: 'HIGH', dueDate: new Date('2026-09-07'), tags: null });
  assert.deepEqual(changes.map((c) => c.field), ['description', 'priority', 'tags']);
  assert.equal(changes[2].newValue, null);
});
