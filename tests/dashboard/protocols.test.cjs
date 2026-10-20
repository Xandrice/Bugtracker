/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node regression harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('../issues/load-ts.cjs');

test('VictoriaLogs endpoints share safe filters, tenant headers, timeout, and CSV format', async t => {
  const old = process.env.VICTORIALOGS_URL; process.env.VICTORIALOGS_URL = 'https://logs.example.test/';
  t.after(() => { if (old === undefined) delete process.env.VICTORIALOGS_URL; else process.env.VICTORIALOGS_URL = old; });
  const calls = [];
  t.mock.method(global, 'fetch', async (url, init) => {
    const body = new URLSearchParams(init.body); calls.push({ url: String(url), body, headers: init.headers });
    assert.ok(init.signal); const endpoint = url.pathname.split('/').at(-1);
    const payload = body.get('format') === 'csv' ? '_msg\r\nhello' : endpoint === 'query' ? '{"_msg":"hello","amount":5}\n' : JSON.stringify({ [endpoint === 'field_values' ? 'values' : endpoint]: [] });
    return new Response(payload);
  });
  const client = loader()('src/lib/victorialogs.ts');
  const input = { query: '*', start: '1h', end: 'now', accountId: '12', projectId: '34', extraFilters: { resource: '" | delete' }, extraFilterQueries: ['citizenid:="82258"'], hiddenFields: ['ip', 'token*'] };
  const rows = await client.queryVictoriaLogs(input); assert.equal(rows.entries[0].amount, '5');
  await client.victoriaLogHits(input); await client.victoriaLogFacets(input); await client.victoriaLogFieldValues(input, 'event'); await client.victoriaLogsCsv(input);
  assert.deepEqual(calls.map(call => call.url.split('/').at(-1)), ['query','hits','facets','field_values','query']);
  for (const call of calls) { assert.equal(call.body.get('timeout'), '10s'); assert.equal(call.headers.AccountID, '12'); assert.equal(call.headers.ProjectID, '34'); assert.deepEqual(call.body.getAll('extra_filters'), [JSON.stringify(input.extraFilters), 'citizenid:="82258"']); assert.deepEqual(JSON.parse(call.body.get('hidden_fields_filters')), input.hiddenFields); }
  assert.equal(calls.at(-1).body.get('format'), 'csv');
  process.env.VICTORIALOGS_URL='https://logs.example.test/select/logsql/query';
  assert.equal(client.getVictoriaLogsConnectionInfo().endpoint,'https://logs.example.test/select/logsql/query');
  t.mock.method(global, 'fetch', async () => new Response('private server detail', {status:504}));
  assert.match((await client.queryVictoriaLogs(input)).error, /shorter time range/);
});

test('paging carries all rows at the same timestamp before moving to older results', async () => {
  const calls = []; const time = '2026-10-04T01:00:00Z';
  const load = loader({ 'server-only': {}, 'src/lib/db': { db:{} }, './victorialogs': { queryVictoriaLogs: async input => { calls.push(input); return { entries: Array.from({length:200},(_,index) => ({ _time:time, _msg:`event ${index}` })), error:null }; } } });
  const { searchLogs } = load('src/lib/log-service.ts');
  const permissions = { role:'Moderator', staffPermissions:{logs:{view:true,advanced:false}} };
  const first = await searchLogs({}, permissions, undefined, true); assert.deepEqual(first.next, {before:time,offset:'200'});
  const second = await searchLogs(first.next, permissions, undefined, true); assert.deepEqual(second.next, {before:time,offset:'400'});
  assert.ok(calls[1].query.includes('_time:<="2026-10-04T01:00:00Z"')); assert.ok(calls[1].query.includes('offset 200'));
});

test('inbound edits preserve attachments and deletes handle mirrored parts without feedback loops', async () => {
  const note = { id:'note', issueId:'issue', source:'DISCORD', discordSyncStatus:'NONE', content:'old\n\nAttachments:\nhttps://clip.example' }; const deleted=[];
  const db = { issue:{findUnique:async()=>({id:'issue'})}, note:{findFirst:async()=>note, findUnique:async()=>note, update:async({data})=>Object.assign(note,data)} };
  const { updateInboundDiscordMessage, importDiscordMessage } = loader({ 'src/lib/db':{db}, './discord-chat':{isOwnDiscordWebhook:async id=>id==='own',deleteDiscordIssueComment:async id=>deleted.push(id)}, './discord':{getDiscordChannelMessage:async()=>null} })('src/lib/discord-inbound.ts');
  await updateInboundDiscordMessage({id:'message',channel_id:'thread',content:'edited'}); assert.equal(note.content,'edited\n\nAttachments:\nhttps://clip.example');
  note.source='APP'; await importDiscordMessage('issue',{id:'message',content:'duplicate',author:{id:'staff'}}); assert.equal(note.content,'edited\n\nAttachments:\nhttps://clip.example');
  await updateInboundDiscordMessage({id:'part-2',channel_id:'thread',webhook_id:'own'},true); assert.deepEqual(deleted,['note']);
  note.discordSyncStatus='DELETING'; await updateInboundDiscordMessage({id:'message',channel_id:'thread'},true); assert.equal(deleted.length,1);
  note.discordSyncStatus='SENDING'; await updateInboundDiscordMessage({id:'part-2',channel_id:'thread'},true); assert.equal(deleted.length,1);
});

test('busy Discord catch-up resumes saved ranges beyond the first 500 messages', async () => {
  let syncedAt=null; let state=null; const imported=new Set();
  const messages=Array.from({length:650},(_,index)=>({id:String(650-index),timestamp:new Date(Date.now()-index*1000).toISOString()}));
  const db={issue:{findUnique:async()=>({discordThreadId:'thread',discordSyncedAt:syncedAt}),updateMany:async({data})=>{syncedAt=data.discordSyncedAt;return {count:1};}},appSetting:{findUnique:async()=>state&&{value:state},upsert:async({update})=>{state=update.value;},deleteMany:async()=>{state=null;}}};
  const {syncIssueNotesFromDiscord}=loader({'src/lib/db':{db},'./discord-inbound':{importDiscordMessage:async(_issue,message)=>imported.add(message.id)},'./discord':{getDiscordChannelMessages:async(_thread,limit,before)=>{const start=before?messages.findIndex(message=>message.id===before)+1:0;return messages.slice(start,start+limit);}}})('src/lib/discordSync.ts');
  assert.equal((await syncIssueNotesFromDiscord('issue')).reason,'catchup-pending'); assert.equal(imported.size,500); assert.ok(state);
  assert.equal((await syncIssueNotesFromDiscord('issue')).reason,'ok'); assert.equal(imported.size,650); assert.equal(state,null);
});

test('tracker deletion claims the note, suppresses delivery races, and restores failures for retry', async () => {
  const note = { id:'note', updatedAt:new Date(), discordSyncStatus:'SENT', discordMessageId:'message', discordDelivery:null, issue:{discordThreadId:'thread'} }; let fail=true; let deleted=false;
  const db={note:{findUnique:async()=>note,updateMany:async({where,data})=>{const matches=where.OR?where.OR.some(clause=>clause.discordSyncStatus?.notIn?!clause.discordSyncStatus.notIn.includes(note.discordSyncStatus):clause.discordSyncStatus===note.discordSyncStatus&&note.updatedAt<clause.updatedAt.lt):where.discordSyncStatus===note.discordSyncStatus;if(!matches)return {count:0};Object.assign(note,data);return {count:1};},deleteMany:async()=>{deleted=true;}}};
  const {deleteDiscordIssueComment}=loader({'src/lib/db':{db},'./discord':{deleteBotThreadMessage:async()=>{assert.equal(note.discordSyncStatus,'DELETING');if(fail)throw new Error('No Manage Messages');}}})('src/lib/discord-chat.ts');
  await assert.rejects(deleteDiscordIssueComment('note'),/Manage Messages/); assert.equal(note.discordSyncStatus,'SENT'); assert.equal(deleted,false);
  note.discordSyncStatus='SENDING'; await assert.rejects(deleteDiscordIssueComment('note'),/syncing/); assert.equal(deleted,false);
  note.discordSyncStatus='SENT'; fail=false; await deleteDiscordIssueComment('note'); assert.equal(deleted,true);
});

test('sign-in proxy keeps shared issue links public and staff pages gated', async t => {
  const old=process.env.NODE_ENV; process.env.NODE_ENV='production'; t.after(()=>{process.env.NODE_ENV=old;});
  const gate=loader({'auth':{},'../auth':{proxyAuth:callback=>callback}})('src/proxy.ts').default;
  const run=(path,auth=null)=>gate({nextUrl:new URL(`https://tracker.example${path}`),url:`https://tracker.example${path}`,auth});
  for(const path of ['/','/issues','/issues/backlog','/issues/BUG-42','/api/auth/signin','/api/discord/webhooks','/api/issues','/api/reports','/api/staff-tools/snapshot']) assert.equal(run(path).status,200,path);
  for(const path of ['/logs','/logs/catalog','/members','/settings','/issues/new','/issues/me','/issues/templates']) assert.equal(run(path).status,307,path);
  assert.equal(run('/api/logs/export').status,401); assert.equal(run('/logs',{user:{id:'staff'}}).status,200);
});
