import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RoadmapClient } from '../../src/app/roadmap/RoadmapClient';

const issue = { id: 'issue', publicKey: 'ECO-1', title: 'Balance payouts', status: 'DONE' };
window.roadmapData = [
  { id: 'economy', name: 'Economy update', description: 'Rebalance jobs and payouts.', status: 'IN_PROGRESS', targetDate: '2026-10-28', issues: [issue] },
  { id: 'launch', name: 'Server launch', description: 'Get the city ready.', status: 'PLANNED', targetDate: '2026-11-02', issues: [] },
  { id: 'ideas', name: 'New player experience', description: 'Onboarding improvements.', status: 'PLANNED', targetDate: null, issues: [] },
];
window.roadmapTest = {
  saveRoadmapMilestone: async (form) => {
    window.lastForm = Object.fromEntries(form);
    if (window.failSave) return { error: 'Simulated save failure' };
    const milestone = { ...window.lastForm, id: form.get('id') || 'created', targetDate: form.get('targetDate') || null, issues: form.getAll('issueId').map(() => issue) };
    window.roadmapData = [...window.roadmapData.filter((item) => item.id !== milestone.id), milestone];
    return { ok: true };
  },
  deleteRoadmapMilestone: async (id) => { window.roadmapData = window.roadmapData.filter((item) => item.id !== id); return { ok: true }; },
  searchRoadmapIssues: async () => ({ issues: [issue] }),
};
function App() {
  const [milestones, setMilestones] = useState(window.roadmapData);
  useEffect(() => { window.roadmapRouter = { refresh: () => setMilestones([...window.roadmapData]) }; }, []);
  return <RoadmapClient milestones={milestones} today="2026-10-23" canManage={!location.search.includes('readonly')} />;
}
createRoot(document.getElementById('root')).render(<App />);
