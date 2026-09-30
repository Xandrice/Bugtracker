import assert from "node:assert/strict";
import {
  LIVE_MAP_PUBLISHER_NOTE,
  LIVE_MAP_STALE_AFTER_MS,
  applyLiveMapIngest,
  getLiveMapSnapshot,
  parseLiveMapIngest,
  projectWorldToMap,
  resetLiveMapStoreForTests,
} from "./live-map";

resetLiveMapStoreForTests();

const empty = getLiveMapSnapshot();
assert.equal(empty.available, false);
assert.equal(empty.source, null);
assert.equal(empty.publisherRequired, true);
assert.equal(empty.players.length, 0);
assert.equal(empty.receivedAt, null);
assert.equal(empty.note, LIVE_MAP_PUBLISHER_NOTE);
assert.equal(empty.staleAfterMs, LIVE_MAP_STALE_AFTER_MS);

const invalidJson = parseLiveMapIngest(null);
assert.equal(invalidJson.ok, false);
if (!invalidJson.ok) assert.equal(invalidJson.error, "Invalid JSON body");
assert.equal(parseLiveMapIngest("players").ok, false);
assert.equal(parseLiveMapIngest({}).ok, false);
assert.equal(parseLiveMapIngest({ players: [{ identifier: "ABC", x: "nope", y: 1 }] }).ok, false);
assert.equal(parseLiveMapIngest({ players: [{ identifier: "ABC", x: Number.NaN, y: 1 }] }).ok, false);
assert.equal(parseLiveMapIngest({ players: [{ identifier: "", x: 1, y: 2 }] }).ok, false);
assert.equal(parseLiveMapIngest({ players: [{ identifier: "ABC", x: 1 }] }).ok, false);

const parsed = parseLiveMapIngest({
  source: "renny",
  serverId: "dev-1",
  players: [
    { identifier: "ABC123", name: "Alex", x: 215.5, y: -890.25, z: 30.1, heading: 91 },
    { identifier: "DEF456", x: -1200, y: 5400 },
  ],
});
assert.equal(parsed.ok, true);
if (!parsed.ok) throw new Error("expected ingest parse to succeed");
assert.equal(parsed.value.source, "renny");
assert.equal(parsed.value.serverId, "dev-1");
assert.equal(parsed.value.players.length, 2);
assert.deepEqual(parsed.value.players[0], {
  identifier: "ABC123",
  name: "Alex",
  x: 215.5,
  y: -890.25,
  z: 30.1,
  heading: 91,
});
assert.equal(parsed.value.players[1].name, null);
assert.equal(parsed.value.players[1].z, null);
assert.equal(parsed.value.players[1].heading, null);

const before = Date.now();
const applied = applyLiveMapIngest(parsed.value, before);
assert.equal(applied.accepted, 2);
assert.equal(applied.rejected, 0);

const live = getLiveMapSnapshot(before);
assert.equal(live.available, true);
assert.equal(live.source, "renny");
assert.equal(live.publisherRequired, false);
assert.equal(live.note, null);
assert.equal(live.players.length, 2);
assert.equal(live.players[0].identifier, "ABC123");
assert.equal(live.players[0].x, 215.5);
assert.equal(live.players[0].y, -890.25);
assert.ok(live.receivedAt);

const stale = getLiveMapSnapshot(before + LIVE_MAP_STALE_AFTER_MS + 1);
assert.equal(stale.available, false);
assert.equal(stale.players.length, 0);
assert.equal(stale.publisherRequired, true);
assert.equal(stale.note, LIVE_MAP_PUBLISHER_NOTE);

resetLiveMapStoreForTests();
applyLiveMapIngest(parsed.value, before);
applyLiveMapIngest(
  {
    source: "fivem",
    serverId: null,
    players: [{ identifier: "ONLY1", name: null, x: 10, y: 20, z: null, heading: null }],
  },
  before + 1000
);
const replaced = getLiveMapSnapshot(before + 1000);
assert.equal(replaced.players.length, 1);
assert.equal(replaced.players[0].identifier, "ONLY1");
assert.equal(replaced.source, "fivem");

const west = projectWorldToMap(-4000, 2000, 800, 600);
const east = projectWorldToMap(4500, 2000, 800, 600);
const south = projectWorldToMap(250, -4000, 800, 600);
const north = projectWorldToMap(250, 8000, 800, 600);
assert.ok(west.x < east.x, "west should project left of east");
assert.ok(north.y < south.y, "north should project above south");
assert.ok(west.x >= 0 && east.x <= 800);
assert.ok(north.y >= 0 && south.y <= 600);

resetLiveMapStoreForTests();
const cleared = parseLiveMapIngest({ source: "fivem", players: [] });
assert.equal(cleared.ok, true);
if (!cleared.ok) throw new Error("expected empty player list to parse");
applyLiveMapIngest(cleared.value, before);
const publishedEmpty = getLiveMapSnapshot(before);
assert.equal(publishedEmpty.available, true);
assert.equal(publishedEmpty.publisherRequired, false);
assert.equal(publishedEmpty.players.length, 0);
assert.equal(publishedEmpty.note, null);

resetLiveMapStoreForTests();
assert.equal(getLiveMapSnapshot().players.length, 0);

console.log("live-map tests passed");
