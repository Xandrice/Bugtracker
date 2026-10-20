/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('../issues/load-ts.cjs');
const load = loader();
for (const file of ['log-events', 'log-filters', 'discord-format', 'player-logs']) load(`src/lib/${file}.test.ts`);
test('priority filters validate enums, survive URLs, and triage ignores impossible filters', () => {
  const { parseIssueListState, issueListSearchParams } = load('src/lib/issue-list-state.ts');
  const state = parseIssueListState({ priority: 'URGENT' }, 'all'); assert.equal(state.priority, 'URGENT');
  assert.equal(issueListSearchParams(state, 'all').get('priority'), 'URGENT'); assert.equal(parseIssueListState({ priority: 'injected' }, 'all').priority, 'ALL');
  const triage = parseIssueListState({ status: 'DONE', assignee: 'staff' }, 'triage'); assert.equal(triage.status, 'ALL'); assert.equal(triage.assignee, 'ALL');
});
test('activity labels handle both null and legacy unassigns and readable field names', () => {
  const { formatActivityLabel, activityValueLabel } = load('src/lib/activity-labels.ts');
  for (const newValue of [null, 'Unassigned']) assert.equal(formatActivityLabel({ action: 'ASSIGNEE_CHANGE', newValue }), 'Unassigned this issue');
  assert.equal(formatActivityLabel({ action: 'STATUS_CHANGE', oldValue: 'OPEN', newValue: 'IN_PROGRESS' }), 'Changed status from Open to In progress');
  assert.equal(formatActivityLabel({ action: 'FIELD_CHANGE', field: 'reproductionSteps', newValue: 'test' }), 'Changed reproduction steps from Not set to test');
  assert.equal(activityValueLabel('2026-10-04T00:00:00Z', 'dueDate'), 'Oct 4, 2026');
});
test('vehicle 0/1/2 mappings and constant-time secret comparisons support different lengths', () => {
  const { numericVehicleState, vehicleStoredState } = load('src/lib/vehicle-state.ts');
  for (const state of [0, '0']) assert.equal(vehicleStoredState(state), false);
  for (const state of [1, '1']) assert.equal(vehicleStoredState(state), true);
  for (const state of [2, '2']) { assert.equal(vehicleStoredState(state), null); assert.equal(numericVehicleState(state), 2); }
  const { secretsEqual } = load('src/lib/secrets.ts'); assert.equal(secretsEqual('å secret', 'å secret'), true);
  for (const actual of [null, '', 'wrong', 'much longer wrong value']) assert.equal(secretsEqual(actual, 'secret'), false);
});
test('log permission grants imply view and explicit role revocations stay revoked', () => {
  const { EMPTY_STAFF_PANEL_PERMISSIONS, FULL_STAFF_PANEL_PERMISSIONS, normalizeStaffPanelPermissions, mergeStaffPanelPermissions } = load('src/lib/staff-permissions.ts');
  assert.equal(normalizeStaffPanelPermissions({ logs: { advanced: true } }).logs.view, true);
  assert.equal(mergeStaffPanelPermissions(FULL_STAFF_PANEL_PERMISSIONS, { logs: { view: false, advanced: false } }).logs.view, false);
  assert.equal(EMPTY_STAFF_PANEL_PERMISSIONS.logs.advanced, false);
});
