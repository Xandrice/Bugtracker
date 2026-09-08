import assert from "node:assert/strict";
import { buildPlayerLogsQuery, localLogDateInput, localLogDateToUtc, parseLogDuration, playerCitizenTagPattern, playerProfileTab, resolvePlayerLogRange } from "./player-logs";

const pattern = new RegExp(playerCitizenTagPattern("82258"));
for (const tags of ["citizenid:82258", "citizenid:82258,resource:robbery", "resource:robbery,citizenid:82258", "resource:robbery,citizenid:82258,username:Skyla Tretyakova"]) {
  assert.ok(pattern.test(tags), tags);
}
for (const tags of ["", "citizenid:822580", "citizenid:182258", "othercitizenid:82258", "source:82258", "username:82258", "citizenid:123,username:Skyla Tretyakova"]) {
  assert.equal(pattern.test(tags), false, tags);
}
for (const identifier of ["a.b", 'a"b', "a\\b", "a|b", "a$", "a[0]", "a+b", "a(b)"]) {
  const query = buildPlayerLogsQuery(identifier, 200);
  const literal = query.slice("tags:~".length, query.indexOf(" | sort"));
  const decoded = JSON.parse(literal);
  assert.ok(new RegExp(decoded).test(`citizenid:${identifier}`));
  assert.equal(new RegExp(decoded).test("citizenid:unrelated"), false);
}
assert.throws(() => buildPlayerLogsQuery("", 200));
assert.throws(() => buildPlayerLogsQuery("123,citizenid:456", 200));
assert.throws(() => buildPlayerLogsQuery("82258", 999));
assert.ok(buildPlayerLogsQuery("82258", 500).endsWith("| sort by (_time) desc | limit 500"));

assert.equal(parseLogDuration("90m"), 5400000);
assert.equal(parseLogDuration("1h30m"), 5400000);
assert.equal(parseLogDuration("1d2h3m4s"), 93784000);
for (const bad of ["", "0m", "-1h", "1.5h", "3", "now", "1w", "1h OR *", "9999999999999999999999d"]) {
  assert.throws(() => parseLogDuration(bad), bad);
}
const now = Date.parse("2026-09-06T00:00:00Z");
assert.deepEqual(resolvePlayerLogRange({}, now), { start: "2026-09-05T23:00:00.000Z", end: "2026-09-06T00:00:00.000Z", limit: 200 });
for (const preset of ["15m", "1h", "6h", "24h", "7d"]) {
  assert.equal(Date.parse(resolvePlayerLogRange({ range: preset }, now).start), now - parseLogDuration(preset));
}
assert.equal(resolvePlayerLogRange({ range: "duration", duration: "90m", limit: "1000" }, now).start, "2026-09-05T22:30:00.000Z");
const dates = { range: "dates", start: "2026-09-05T23:00:00Z", end: "2026-09-06T00:00:00Z" };
assert.equal(resolvePlayerLogRange(dates).start, "2026-09-05T23:00:00.000Z");
for (const params of [{ range: "unknown" }, { limit: "NaN" }, { range: "dates" }, { ...dates, end: dates.start }, { ...dates, start: dates.end }, { ...dates, start: "2026-02-30T00:00:00Z" }, { ...dates, start: "2026-09-05T23:00:00" }]) {
  assert.throws(() => resolvePlayerLogRange(params));
}
// Browser URL serialization preserves absolute bounds and cannot override identity.
const restored = Object.fromEntries(new URLSearchParams(dates));
assert.deepEqual(resolvePlayerLogRange(restored), resolvePlayerLogRange(dates));
assert.deepEqual(resolvePlayerLogRange({ ...dates, q: "*", identifier: "another-player" }), resolvePlayerLogRange(dates));
assert.equal(playerProfileTab({ tab: "logs" }, false), "overview");
assert.equal(playerProfileTab({ tab: "logs" }, true), "logs");
assert.equal(playerProfileTab({ tab: "assets" }, false), "assets");
assert.equal(playerProfileTab({ tab: "history" }, false), "history");
assert.equal(playerProfileTab({ tab: "invalid" }, true), "overview");
const previousTimezone = process.env.TZ;
try {
  process.env.TZ = "America/Los_Angeles";
  assert.equal(localLogDateToUtc("2026-09-05T16:36:08"), "2026-09-05T23:36:08.000Z");
  assert.equal(localLogDateInput("2026-09-05T23:36:08Z"), "2026-09-05T16:36:08");
  assert.equal(localLogDateToUtc("2026-01-05T16:36"), "2026-01-06T00:36:00.000Z");
  assert.throws(() => localLogDateToUtc("2026-03-08T02:30:00"));
  assert.throws(() => localLogDateToUtc("2026-02-30T00:00:00"));
  process.env.TZ = "UTC";
  assert.equal(localLogDateToUtc("2026-09-05T23:36:08"), "2026-09-05T23:36:08.000Z");
} finally {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
}
console.log("Player log matching, ranges, limits, and tab tests passed.");
