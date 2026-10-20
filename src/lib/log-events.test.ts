import { test } from "node:test";
import assert from "node:assert/strict";
import { describeLogEvent, parseLogTags, scrubLogEntry } from "./log-events";

test("tags accept comma spaces and values containing colons without trusting prototype keys", () => {
  const tags = parseLogTags("citizenid:82258, resource:robbery, username:Skyla Tretyakova,license:license:abc,__proto__:safe,bad");
  assert.equal(tags.citizenid, "82258"); assert.equal(tags.username, "Skyla Tretyakova"); assert.equal(tags.license, "license:abc");
  assert.equal(Object.getPrototypeOf(tags), null); assert.equal(tags.__proto__, "safe");
});
test("known events summarize amounts and actors; unknown messages remain faithful", () => {
  const event = describeLogEvent({ resource: "qb-banking", event: "add_money", tags: "username:Skyla Tretyakova,amount:5000,account:bank,from:Tom Smith" });
  assert.equal(event.summary, "Skyla Tretyakova received $5,000 (bank) from Tom Smith"); assert.equal(event.category, "Money");
  assert.equal(describeLogEvent({ resource: "custom", event: "mystery", _msg: "Original event" }).summary, "Original event");
  assert.equal(describeLogEvent({ resource: "robbery", event: "kill", tags: "citizenid:82258" }).category, "Combat");
});
test("guided rows remove sensitive fields, tagged identifiers, and IPs embedded in messages", () => {
  const row = scrubLogEntry({ ip: "192.0.2.1", password: "secret", _stream: '{ip="192.0.2.1"}', tags: "citizenid:82258, license:abc,ip:192.0.2.1,username:Skyla", _msg: "connected from 192.0.2.1:30120 license:abc" });
  assert.equal(row.ip, undefined); assert.equal(row.password, undefined); assert.equal(row._stream, undefined);
  assert.equal(row.tags, "citizenid:82258,username:Skyla"); assert.ok(!JSON.stringify(row).includes("192.0.2.1")); assert.ok(!JSON.stringify(row).includes("abc"));
  const ipv6 = scrubLogEntry({ _time: "2026-10-04T09:30:15Z", _msg: "endpoint [2001:db8::42]:30120 token=secret-value" });
  assert.equal(ipv6._time, "2026-10-04T09:30:15Z"); assert.ok(!ipv6._msg.includes("2001:db8")); assert.ok(!ipv6._msg.includes("secret-value"));
});
