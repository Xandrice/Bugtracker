import assert from "node:assert/strict";
import {
  INVENTORY_ITEM_CAP,
  coerceInventoryArray,
  collectContainerIds,
  mapInventoryItem,
  parseInventoryItems,
  playerInventoryNames,
  vehicleInventoryNames,
} from "./fivem-inventory-parse";

const oxCarried = [
  { slot: 1, name: "hotdog", count: 4 },
  { slot: 2, name: "water", count: 3 },
  {
    slot: 49,
    name: "laptop",
    count: 1,
    metadata: { durability: 100, password: false, serial: "20843U2I39KY88" },
  },
  {
    slot: 10,
    name: "WEAPON_DUTYPISTOL",
    count: 1,
    metadata: { serial: "741364POL620108", registered: "Josh Sims", ammo: 15, durability: 97.3 },
  },
  {
    slot: 14,
    name: "wallet",
    count: 1,
    metadata: { size: [10, 5000], container: "YRJ1776002911", weight: 0 },
  },
];

const parsed = parseInventoryItems(oxCarried);
assert.equal(parsed.totalItems, 5);
assert.equal(parsed.capped, false);
assert.equal(parsed.items[0].name, "hotdog");
assert.equal(parsed.items[0].count, 4);

const pistol = parsed.items.find((item) => item.name === "WEAPON_DUTYPISTOL");
assert.ok(pistol);
assert.deepEqual(pistol.details, [
  "serial 741364POL620108",
  "ammo 15",
  "registered Josh Sims",
  "durability 97",
]);

const laptop = parsed.items.find((item) => item.name === "laptop");
assert.ok(laptop);
assert.ok(laptop.details.includes("serial 20843U2I39KY88"));
assert.equal(
  laptop.details.some((detail) => detail.startsWith("durability")),
  false,
  "100% durability should not be treated as a wear percentage"
);

const wallet = parsed.items.find((item) => item.name === "wallet");
assert.ok(wallet);
assert.equal(wallet.containerId, "YRJ1776002911");
assert.deepEqual(collectContainerIds(oxCarried), ["YRJ1776002911"]);

const asString = parseInventoryItems(JSON.stringify(oxCarried));
assert.equal(asString.totalItems, 5);

const slotObject = parseInventoryItems({
  "1": { name: "phone", amount: 1 },
  "2": { name: "money", amount: 395 },
});
assert.equal(slotObject.totalItems, 2);
assert.equal(slotObject.items[0].name, "phone");
assert.equal(slotObject.items[1].count, 395);

const wrapped = parseInventoryItems({ items: [{ name: "bandage", count: 3 }] });
assert.equal(wrapped.items[0].name, "bandage");

assert.equal(mapInventoryItem({ count: 2 }), null);
assert.equal(mapInventoryItem({ name: "lockpick", count: 0 }), null);
assert.deepEqual(coerceInventoryArray(null), []);
assert.deepEqual(coerceInventoryArray(""), []);

const huge = Array.from({ length: INVENTORY_ITEM_CAP + 17 }, (_, index) => ({
  name: `item_${index}`,
  count: 1,
  slot: index + 1,
}));
const capped = parseInventoryItems(huge);
assert.equal(capped.totalItems, INVENTORY_ITEM_CAP + 17);
assert.equal(capped.items.length, INVENTORY_ITEM_CAP);
assert.equal(capped.capped, true);

const plateNames = vehicleInventoryNames("4RJ501MH");
assert.ok(plateNames.includes("4RJ501MH"));
assert.ok(plateNames.includes("LS4RJ501MH"));
assert.ok(plateNames.includes("trunk-4RJ501MH"));
assert.ok(plateNames.includes("glovebox-4RJ501MH"));
assert.deepEqual(vehicleInventoryNames("  "), []);

const spaced = vehicleInventoryNames("4RJ 501-MH");
assert.ok(spaced.includes("LS4RJ501MH"));

assert.deepEqual(playerInventoryNames("31426"), [
  "31426",
  "player-31426",
  "player31426",
  "stash-31426",
]);

const labeled = mapInventoryItem({
  name: "weed",
  count: 75,
  metadata: { label: "Hindu Kush", strain: "Hindu Kush" },
});
assert.equal(labeled?.label, "Hindu Kush");

console.log("fivem-inventory-parse tests passed");
