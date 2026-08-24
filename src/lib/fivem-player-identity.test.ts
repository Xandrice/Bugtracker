import assert from "node:assert/strict";
import {
  expandIdentifierSearchTerms,
  extractDiscordId,
  formatPlaytimeDuration,
  formatPresenceDate,
  looksLikeIdentifierQuery,
} from "./fivem-player-identity";

function sameMembers(actual: string[], expected: string[]) {
  assert.deepEqual(new Set(actual), new Set(expected), `${actual.join(",")} !== ${expected.join(",")}`);
}

sameMembers(expandIdentifierSearchTerms("123456789012345678"), [
  "123456789012345678",
  "discord:123456789012345678",
]);
sameMembers(expandIdentifierSearchTerms("discord:123456789012345678"), [
  "discord:123456789012345678",
  "123456789012345678",
]);
sameMembers(expandIdentifierSearchTerms("license:abc123def456abc123def456abc123def456abc1"), [
  "license:abc123def456abc123def456abc123def456abc1",
  "abc123def456abc123def456abc123def456abc1",
  "license2:abc123def456abc123def456abc123def456abc1",
]);
sameMembers(expandIdentifierSearchTerms("license2:9540013671a29b12d0e9f6649e82f930364af2e1"), [
  "license2:9540013671a29b12d0e9f6649e82f930364af2e1",
  "9540013671a29b12d0e9f6649e82f930364af2e1",
  "license:9540013671a29b12d0e9f6649e82f930364af2e1",
]);
sameMembers(expandIdentifierSearchTerms("steam:1100001abcdef"), [
  "steam:1100001abcdef",
  "1100001abcdef",
]);
sameMembers(expandIdentifierSearchTerms("1100001abcdef"), [
  "1100001abcdef",
  "steam:1100001abcdef",
]);
sameMembers(expandIdentifierSearchTerms("Todd Williams"), ["Todd Williams"]);
sameMembers(expandIdentifierSearchTerms("31426"), ["31426"]);

assert.equal(looksLikeIdentifierQuery("Todd"), false);
assert.equal(looksLikeIdentifierQuery("discord:123456789012345678"), true);

assert.equal(extractDiscordId({ discord: "discord:218882401319780352" }), "218882401319780352");
assert.equal(extractDiscordId({ discord: "218882401319780352" }), "218882401319780352");
assert.equal(
  extractDiscordId({
    identifiers: JSON.stringify({
      username: "Xandrice",
      discord: "discord:223622182192939008",
      license: "license:f19fbf98eda9f2eafbe05c1c6f7a16a33bfa1e10",
    }),
  }),
  "223622182192939008"
);
assert.equal(extractDiscordId({ identifiers: ["license:abc", "discord:386230416312631306"] }), "386230416312631306");
assert.equal(extractDiscordId({ identifier: "discord:151373903774613504" }), "151373903774613504");
assert.equal(extractDiscordId({ license: "license2:abc" }), null);

assert.equal(formatPlaytimeDuration(724), "12h 4m");
assert.equal(formatPlaytimeDuration(0), "0m");
assert.equal(formatPlaytimeDuration({ hours: 12, minutes: 4 }), "12h 4m");
assert.equal(formatPlaytimeDuration(null), null);
assert.equal(formatPlaytimeDuration(""), null);

const labeled = formatPresenceDate("2026-06-17 02:31:00");
assert.ok(labeled && labeled.length > 0, "presence date should format");
assert.equal(formatPresenceDate(null), null);
assert.equal(formatPresenceDate(""), null);

console.log("fivem-player-identity tests passed");
