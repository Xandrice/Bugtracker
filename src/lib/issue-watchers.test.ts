import assert from "node:assert/strict";
import { uniqueUserIds } from "./issue-watchers";

assert.deepEqual(uniqueUserIds(), []);
assert.deepEqual(uniqueUserIds(null, undefined, ""), []);
assert.deepEqual(uniqueUserIds("reporter", "assignee"), ["reporter", "assignee"]);
assert.deepEqual(
  uniqueUserIds("reporter", "assignee", ["assignee", "watcher"]),
  ["reporter", "assignee", "watcher"]
);

// STATUS_CHANGE recipients: reporter + assignee + explicit watchers
assert.deepEqual(
  uniqueUserIds("r1", "a1", ["w1", "r1"]),
  ["r1", "a1", "w1"]
);

// COMMENT recipients: assignee (existing) + explicit watchers, not reporter
assert.deepEqual(uniqueUserIds("a1", ["w1", "w2"]), ["a1", "w1", "w2"]);
assert.deepEqual(uniqueUserIds(null, ["w1"]), ["w1"]);

console.log("issue-watchers tests passed");
