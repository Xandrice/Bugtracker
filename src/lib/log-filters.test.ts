import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGuidedLogsQuery, parseLogFilters, playerIdentityQuery } from "./log-filters";
test("guided input is literal and resource/event filters remain JSON data", () => {
  const attack = 'x" | delete | *';
  const filters = parseLogFilters({ q: attack, resource: attack, event: "transfer", range: "1h" });
  const result = buildGuidedLogsQuery(filters);
  assert.equal(result.extraFilters.resource, attack); assert.equal(result.extraFilters.event, "transfer");
  assert.equal(result.query, attack.match(/\S+/g)!.map(word => JSON.stringify(word)).join(" AND "));
  assert.ok(!result.query.includes('x" | delete'));
  assert.throws(() => parseLogFilters({ before: "bad" })); assert.throws(() => parseLogFilters({ offset: "1; DROP" }));
});
test("player queries match full citizen, license and Discord tokens, including pre-character connections", () => {
  const query = playerIdentityQuery({ citizenid: 'a"b', license: "license:abcdef", discord: "discord:123456" });
  assert.ok(query.includes('citizenid:="a\\"b"')); assert.ok(query.includes('license:="abcdef"')); assert.ok(query.includes('discord:="123456"'));
  assert.ok(query.includes("tags:")); assert.ok(query.includes("tags:~")); assert.throws(() => playerIdentityQuery({ citizenid: "bad,citizenid:other" }));
});
