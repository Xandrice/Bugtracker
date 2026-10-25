import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RoadmapClient } from '../../src/app/roadmap/RoadmapClient';

const issue = { id: 'issue', publicKey: 'ECO-1', title: 'Balance payouts', status: 'DONE' };
window.categoryData = [{ id: 'engineering', name: 'Engineering', color: '#4363D8' }, { id: 'launches', name: 'Launches', color: '#F58231' }];
window.taskData = [
  { id: 'build', publicKey: 'ECO-2', title: 'Build payouts', status: 'IN_PROGRESS', startDate: '2026-10-24', dueDate: '2026-10-27', categories: [window.categoryData[0]] },
  { id: 'undated', title: 'Undated task', status: 'OPEN', startDate: null, dueDate: null, categories: [] },
  { id: 'due-only', title: 'Due date only', status: 'OPEN', startDate: null, dueDate: '2026-10-28', categories: [] },
];
window.roadmapData = [
  { id: 'economy', name: 'Economy update', description: 'Rebalance jobs and payouts.', status: 'IN_PROGRESS', targetDate: '2026-10-28', categories: [window.categoryData[0]], issues: [issue] },
  { id: 'launch', name: 'Server launch', description: 'Get the city ready.', status: 'PLANNED', targetDate: '2026-11-02', issues: [] },
  { id: 'ideas', name: 'New player experience', description: 'Onboarding improvements.', status: 'PLANNED', targetDate: null, issues: [] },
];
window.roadmapTest = {
  saveRoadmapMilestone: async (form) => {
    window.lastForm = Object.fromEntries(form);
    if (window.failSave) return { error: 'Simulated save failure' };
    const milestone = { ...window.lastForm, id: form.get('id') || 'created', targetDate: form.get('targetDate') || null, startDate: form.get('startDate') || null, issues: form.getAll('issueId').map(() => issue), categories: window.categoryData.filter(c => form.getAll('categoryId').includes(c.id)) };
    window.roadmapData = [...window.roadmapData.filter((item) => item.id !== milestone.id), milestone];
    return { ok: true };
  },
  deleteRoadmapMilestone: async (id) => { window.roadmapData = window.roadmapData.filter((item) => item.id !== id); return { ok: true }; },
  searchRoadmapIssues: async () => ({ issues: [issue] }),
  saveScheduleCategory: async form => {
    const item = { ...Object.fromEntries(form), id: form.get('id') || 'custom' };
    window.categoryData = [...window.categoryData.filter(c => c.id !== item.id), item];
    for (const source of [window.roadmapData, window.taskData]) for (const row of source) row.categories = (row.categories || []).map(c => c.id === item.id ? item : c);
    return { ok: true };
  },
  deleteScheduleCategory: async id => {
    window.categoryData = window.categoryData.filter(c => c.id !== id);
    for (const source of [window.roadmapData, window.taskData]) for (const row of source) row.categories = (row.categories || []).filter(c => c.id !== id);
    return { ok: true };
  },
  saveTaskSchedule: async form => {
    const task = window.taskData.find(t => t.id === form.get('id'));
    Object.assign(task, { startDate: form.get('startDate'), dueDate: form.get('dueDate'), categories: window.categoryData.filter(c => form.getAll('categoryId').includes(c.id)) });
    return { ok: true };
  },
  moveScheduleItem: async input => {
    window.lastMove = input;
    if (window.failMove) return { error: 'Simulated drag save failure' };
    const row = (input.kind === 'ISSUE' ? window.taskData : window.roadmapData).find(t => t.id === input.id);
    Object.assign(row, { startDate: input.start, [input.kind === 'ISSUE' ? 'dueDate' : 'targetDate']: input.end });
    return { ok: true };
  },
};
function App() {
  const [, refresh] = useState(0);
  useEffect(() => { window.roadmapRouter = { refresh: () => refresh(value => value + 1) }; }, []);
  return <RoadmapClient milestones={window.roadmapData} categories={window.categoryData} tasks={window.taskData} canEditTasks={!location.search.includes('readonly')} today="2026-10-23" canManage={!location.search.includes('readonly')} />;
}
createRoot(document.getElementById('root')).render(<App />);
