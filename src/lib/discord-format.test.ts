import { test } from "node:test";
import assert from "node:assert/strict";
import { discordCommentDisplay, discordMessageUrl, formatDiscordComment, splitDiscordMessage } from "./discord-format";
test("mentions ping only linked users and Markdown images become URLs", () => {
  const result = formatDiscordComment("Hi @SkylaTretyakova and @SkylaTretyakovaExtra @everyone <@&123> ![clip](https://example.com/image.png)", [{ name: "Skyla Tretyakova", discordId: "123456" }]);
  assert.ok(result.content.includes("Hi <@123456> and @SkylaTretyakovaExtra")); assert.ok(result.content.includes("https://example.com/image.png")); assert.ok(!result.content.includes("!["));
  assert.deepEqual(result.allowed_mentions.parse, []); assert.deepEqual(result.allowed_mentions.users, ["123456"]);
});
test("long comments preserve every character and surrogate pair within Discord limits", () => {
  const text = "x".repeat(1999) + "😀" + "\n" + "y ".repeat(2500);
  const parts = splitDiscordMessage(text); assert.equal(parts.join(""), text); assert.ok(parts.every(part => part.length <= 2000)); assert.ok(parts.every(part => !/[\uD800-\uDBFF]$/.test(part)));
  assert.equal(discordCommentDisplay("**Discord - Skyla**\n\nPost: https://discord.com/channels/1/2\n\nhello"), "hello");
  assert.equal(discordMessageUrl("2", "3", "1"), "https://discord.com/channels/1/2/3");
  assert.equal(discordMessageUrl("2", "3", null, "Post: https://discord.com/channels/1/2"), "https://discord.com/channels/1/2/3");
});
