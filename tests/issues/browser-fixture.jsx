import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NewIssueForm } from '../../src/app/issues/new/NewIssueForm';
import { PagedIssueGrid } from '../../src/components/issues/PagedIssueGrid';
import { IssueActionForm, IssueFieldError } from '../../src/components/issues/IssueActionForm';
import { parseIssueListState, issueListSearchParams } from '../../src/lib/issue-list-state';

const template = { id: 'template', slug: 'template', name: 'Bug template', description: 'Common report', type: 'BUG', priority: 'HIGH', severity: 'MAJOR', titleHint: 'Describe the problem', title: 'Template title', body: 'Template body', reproductionSteps: 'Template steps', expectedBehavior: 'Template expected', resourceName: 'police', sortOrder: 0, archivedAt: null };
const row = (id, status = 'OPEN') => ({ id, publicKey: id, title: id, status, type: 'BUG', priority: 'MEDIUM', severity: 'MINOR', assigneeId: null, assigneeName: null, dueDate: null, updatedAt: new Date('2026-09-07'), resourceName: 'police', storyPoints: null, parentIssueId: null, matches: true, childCount: 0 });
const childRows = [{ ...row('child-one'), parentIssueId: 'parent' }, { ...row('child-two'), parentIssueId: 'parent' }];
window.issueTest = {
  createIssue: async (data) => { window.lastSubmission = Object.fromEntries(data); return { error: 'Check the highlighted fields.', fieldErrors: { title: 'Enter a title.' } }; },
  loadIssueChildren: async (id) => ({ rows: id === "parent" ? structuredClone(childRows) : [{ ...row("context-child"), parentIssueId: "context-parent" }] }),
  updateIssueWorkflow: async (id, changes) => { if (window.failUpdate) return { error: 'Simulated update failed' }; Object.assign(childRows.find((r) => r.id === id) || {}, changes); return { issue: { id, ...changes } }; },
  updateIssueAssignee: async () => ({ error: 'Simulated assignment failure' }),
  bulkUpdateIssues: async () => { childRows[0].status = 'REVIEW'; return { updated: 1, skipped: [{ id: 'child-two', error: 'Simulated row failure' }] }; },
  saveSavedView: async (name, filters) => ({ view: { id: 'saved', name, filters } }),
  deleteSavedView: async () => ({ ok: true }),
};
function makePage() {
  const state = parseIssueListState(Object.fromEntries(new URLSearchParams(location.search)), 'all');
  return { state, scope: 'all', groups: state.page === 2 ? [{ parent: row('next-parent'), expanded: false, children: [] }] : [
    { parent: { ...row('parent'), childCount: 2 }, expanded: false, children: [] },
    { parent: { ...row('context-parent', 'DONE'), matches: false, childCount: 1 }, expanded: true, children: [{ ...row('context-child'), parentIssueId: 'context-parent' }] },
  ], groupCount: 51, matchingCount: 54, pageCount: 2 };
}
window.issueRouter = {};
function App() {
  const [page, setPage] = useState(makePage);
  useEffect(() => {
    Object.assign(window.issueRouter, {
    refresh: () => setPage(makePage()),
    push: (href) => { history.pushState(null, '', href); setPage(makePage()); },
    replace: (href) => { history.replaceState(null, '', href); setPage(makePage()); },
    });
    const onPopState = () => setPage(makePage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  if (location.pathname === '/forms') return <>
    <NewIssueForm templates={[template]} selectedTemplate={null} createInBacklog={false} fallbackType="BUG" canManageTemplates={false} />
    <IssueActionForm aria-label="Second form" action={async () => ({ error: 'Second error', fieldErrors: { title: 'Second title error' } })}>
      <input name="title" aria-label="Second title" defaultValue="keep me" /><IssueFieldError field="title" /><button>Submit second</button>
    </IssueActionForm>
  </>;
  return <main className="p-6"><PagedIssueGrid key={issueListSearchParams(page.state, 'all').toString()} page={page} users={[{ id: 'staff', name: 'Staff' }]} canEdit canAssign signedIn savedViews={[]} /></main>;
}
createRoot(document.getElementById('root')).render(<App />);
