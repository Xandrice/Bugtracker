/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./issues/load-ts.cjs');

test('player lists expose character names separately from account names', async (t) => {
  const originalUrl = process.env.FIVEM_DB_URL;
  const originalPool = globalThis.fivemDbPool;
  const originalSchema = globalThis.fivemSchemaPromise;
  process.env.FIVEM_DB_URL = 'mysql://test.invalid/test';
  t.after(() => {
    if (originalUrl === undefined) delete process.env.FIVEM_DB_URL;
    else process.env.FIVEM_DB_URL = originalUrl;
    globalThis.fivemDbPool = originalPool;
    globalThis.fivemSchemaPromise = originalSchema;
  });
  const db = loader({ 'server-only': {} })('src/lib/fivem-db.ts');

  for (const scenario of [
    { label: 'JSON charinfo', fields: { charinfo: '{"firstname":"Jane","lastname":"Doe"}' }, expected: 'Jane Doe' },
    { label: 'object charinfo', fields: { charinfo: { firstname: ' Jane ', lastname: ' Doe ' } }, expected: 'Jane Doe' },
    { label: 'direct name columns', fields: { firstname: ' Jane ', lastname: ' Doe ' }, expected: 'Jane Doe' },
    { label: 'snake case columns', fields: { first_name: 'Jane', last_name: 'Doe' }, expected: 'Jane Doe' },
    { label: 'snake case profile', fields: { identity: { first_name: 'Jane', last_name: 'Doe' } }, expected: 'Jane Doe' },
    { label: 'first name only', fields: { charinfo: { firstname: 'Jane' } }, expected: 'Jane' },
    { label: 'last name only', fields: { charinfo: { lastname: 'Doe' } }, expected: 'Doe' },
    { label: 'direct names take priority', fields: { firstname: 'Jane', lastname: 'Doe', charinfo: { firstname: 'Other', lastname: 'Name' } }, expected: 'Jane Doe' },
    { label: 'empty columns fall back to charinfo', fields: { firstname: ' ', lastname: null, charinfo: { firstname: 'Jane', lastname: 'Doe' } }, expected: 'Jane Doe' },
    { label: 'missing names', fields: {}, expected: null },
    { label: 'blank names', fields: { charinfo: { firstname: ' ', lastname: '' } }, expected: null },
    { label: 'malformed charinfo', fields: { charinfo: '{invalid' }, expected: null },
  ]) {
    await t.test(scenario.label, async () => {
      const row = { citizenid: 'ABC123', name: 'AccountHandle', ...scenario.fields };
      const schema = Object.keys(row).map((columnName) => ({
        tableName: 'players', columnName, characterSet: 'utf8mb4', collation: 'utf8mb4_general_ci',
      }));
      globalThis.fivemSchemaPromise = undefined;
      globalThis.fivemDbPool = {
        query: async (sql) => {
          if (sql.includes('information_schema.columns')) return [schema];
          if (sql.includes('COUNT(*)')) return [[{ count: 1 }]];
          return [[row]];
        },
      };

      const snapshot = await db.getStaffToolsSnapshot({});
      assert.equal(snapshot.connectionError, null);
      assert.equal(snapshot.players[0].characterName, scenario.expected);
      assert.equal(snapshot.players[0].displayName, 'AccountHandle');
    });
  }
});

test('player searches reconcile related text collations while preserving numeric joins', async (t) => {
  const originalUrl = process.env.FIVEM_DB_URL;
  const originalPool = globalThis.fivemDbPool;
  const originalSchema = globalThis.fivemSchemaPromise;
  process.env.FIVEM_DB_URL = 'mysql://test.invalid/test';
  t.after(() => {
    if (originalUrl === undefined) delete process.env.FIVEM_DB_URL;
    else process.env.FIVEM_DB_URL = originalUrl;
    globalThis.fivemDbPool = originalPool;
    globalThis.fivemSchemaPromise = originalSchema;
  });
  const db = loader({ 'server-only': {} })('src/lib/fivem-db.ts');

  for (const scenario of [
    { player: 'utf8mb4_general_ci', related: 'utf8mb4_unicode_ci', charset: 'utf8mb4', convert: true },
    { player: 'utf8mb4_unicode_ci', related: 'utf8mb4_general_ci', charset: 'utf8mb4', convert: true },
    { player: 'utf8mb4_unicode_ci', related: 'utf8mb4_unicode_ci', charset: 'utf8mb4', convert: false },
    { player: 'latin1_swedish_ci', related: 'utf8mb4_unicode_ci', charset: 'utf8mb4', convert: true },
    { player: null, related: null, charset: null, convert: false },
  ]) {
    await t.test(JSON.stringify(scenario), async () => {
      const column = (tableName, columnName, collation, characterSet) => ({ tableName, columnName, collation, characterSet });
      const schema = [
        column('players', 'citizenid', 'utf8mb4_general_ci', 'utf8mb4'),
        column('players', 'name', 'utf8mb4_general_ci', 'utf8mb4'),
        column('players', 'userid', scenario.player, scenario.player?.startsWith('latin1') ? 'latin1' : scenario.charset),
        column('player_identifiers', 'user_id', scenario.related, scenario.charset),
        column('player_identifiers', 'discord', 'utf8mb4_unicode_ci', 'utf8mb4'),
      ];
      const queries = [];
      globalThis.fivemSchemaPromise = undefined;
      globalThis.fivemDbPool = {
        query: async (sql, params) => {
          if (sql.includes('information_schema.columns')) return [schema];
          if (sql.includes('COUNT(*)')) return [[{ count: 1 }]];
          queries.push({ sql, params });
          return [[{ citizenid: 'ABC123', name: 'Test Player', userid: '7' }]];
        },
      };
      const snapshot = await db.getStaffToolsSnapshot({ playerSearch: 'discord:123456789012345678', limit: 10 });
      assert.equal(snapshot.connectionError, null);
      assert.equal(snapshot.players[0].identifier, 'ABC123');
      const { sql, params } = queries[0];
      const rightKey = scenario.convert
        ? `CONVERT(\`players\`.\`userid\` USING \`${scenario.charset}\`) COLLATE \`${scenario.related}\``
        : '`players`.`userid`';
      assert.ok(sql.includes(`\`player_identifiers\`.\`user_id\`\n        = ${rightKey}`), sql);
      assert.equal(sql.includes('CONVERT('), scenario.convert);
      assert.ok(params.includes('%discord:123456789012345678%'));
      assert.ok(params.includes('%123456789012345678%'));
      assert.equal(params.at(-1), 10);

      queries.length = 0;
      await db.getStaffToolsSnapshot({ playerSearch: '  ' });
      assert.ok(!queries[0].sql.includes('EXISTS'));
      assert.ok(!queries[0].sql.includes('CONVERT('));
    });
  }
});
