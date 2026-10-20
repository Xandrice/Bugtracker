import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogExplorer } from '../../src/components/logs/LogExplorer';
const now = Date.now();
const entries = [
  { _time: new Date(now - 120000).toISOString(), resource: 'qb-banking', event: 'add_money', tags: 'citizenid:82258, username:Skyla Tretyakova,amount:5000,account:bank,from:Tom Smith', _msg: 'Money received' },
  { _time: new Date(now - 300000).toISOString(), resource: 'robbery', event: 'kill', citizenid: '82258', _msg: 'Skyla was killed during the robbery at Legion Square' },
];
window.logRouter = { push: url => { history.pushState(null,'',url); window.dispatchEvent(new Event('fixture-navigate')); } };
window.logFixture = { calls: 0, async search(params, _lockedPlayer, older) {
  this.calls++;
  await new Promise(resolve => setTimeout(resolve,200));
  const money = params.category === 'Money';
  return { entries: older ? [{ ...entries[1], _time: new Date(now - 600000).toISOString(), _msg: 'An earlier robbery event' }] : money ? entries.slice(0,1) : entries, error: null, warning: null, debug: null, logsQL: null, start: new Date(now - 3600000).toISOString(), end: new Date(now).toISOString(), next: older ? null : { before: entries[1]._time, offset: '1' }, hits: [{ fields: {resource:'qb-banking',event:'add_money'}, timestamps:[new Date(now-300000).toISOString(),new Date(now-120000).toISOString()], values:[2,5], total:7 }, { fields:{resource:'robbery',event:'kill'}, timestamps:[new Date(now-300000).toISOString()], values:[3],total:3 }], facets:[{field_name:'resource',values:[{field_value:'qb-banking',hits:7},{field_value:'robbery',hits:3}]}], resources:['qb-banking','robbery'],events:['add_money','kill'] };
} };
function App() {
  const [params,setParams] = useState(() => Object.fromEntries(new URLSearchParams(location.search)));
  useEffect(() => { const update = () => setParams(Object.fromEntries(new URLSearchParams(location.search))); window.addEventListener('fixture-navigate',update); return () => window.removeEventListener('fixture-navigate',update); },[]);
  return <main className="mx-auto max-w-[1400px] space-y-4 p-5"><h1 className="text-2xl font-semibold">Logs</h1><p className="text-sm text-muted-foreground">Isolated UI check · Moderator permissions · representative data</p><LogExplorer params={params} players /></main>;
}
createRoot(document.getElementById('root')).render(<App />);
