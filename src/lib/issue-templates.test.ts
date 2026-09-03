import assert from "node:assert/strict";
import {
  DEFAULT_ISSUE_TEMPLATES,
  findIssueTemplate,
  issueFormPrefillFromTemplate,
  parseIssueTemplateFields,
  slugifyIssueTemplateName,
} from "./issue-templates";

assert.equal(DEFAULT_ISSUE_TEMPLATES.length, 4);
assert.deepEqual(
  DEFAULT_ISSUE_TEMPLATES.map((template) => template.slug),
  ["bug-report", "script-crash", "feature-request", "player-facing-task"]
);
assert.equal(
  new Set(DEFAULT_ISSUE_TEMPLATES.map((template) => template.id)).size,
  DEFAULT_ISSUE_TEMPLATES.length
);

assert.equal(slugifyIssueTemplateName("Bug report"), "bug-report");
assert.equal(slugifyIssueTemplateName("  Script   Crash!! "), "script-crash");
assert.equal(slugifyIssueTemplateName("@@@"), "template");

const listed = DEFAULT_ISSUE_TEMPLATES.map((template) => ({
  id: template.id,
  slug: template.slug,
}));
assert.equal(findIssueTemplate(listed, "bug-report")?.id, "issue-template-bug-report");
assert.equal(
  findIssueTemplate(listed, "issue-template-script-crash")?.slug,
  "script-crash"
);
assert.equal(findIssueTemplate(listed, " missing "), null);
assert.equal(findIssueTemplate(listed, ""), null);

const noTemplate = issueFormPrefillFromTemplate(null, "FEATURE");
assert.equal(noTemplate.type, "FEATURE");
assert.equal(noTemplate.priority, "MEDIUM");
assert.equal(noTemplate.severity, "MINOR");
assert.equal(noTemplate.title, "");
assert.equal(noTemplate.description, "");
assert.match(noTemplate.titlePlaceholder, /inventory/i);

const crash = DEFAULT_ISSUE_TEMPLATES.find((template) => template.slug === "script-crash");
assert.ok(crash);
const crashPrefill = issueFormPrefillFromTemplate(crash, "TASK");
assert.equal(crashPrefill.type, "BUG");
assert.equal(crashPrefill.priority, "HIGH");
assert.equal(crashPrefill.severity, "CRITICAL");
assert.equal(crashPrefill.titlePlaceholder, crash.titleHint);
assert.ok(crashPrefill.description.includes("resource crashed"));
assert.ok(crashPrefill.reproductionSteps.includes("Crash"));
assert.ok(crashPrefill.expectedBehavior.includes("stay running"));

const titled = issueFormPrefillFromTemplate({
  type: "TASK",
  priority: "LOW",
  severity: "BLOCKER",
  titleHint: "Placeholder only",
  title: " Restock MRPD lockers ",
  body: "Do the thing",
  reproductionSteps: "ignored for tasks at parse-time, kept on apply",
  expectedBehavior: null,
  resourceName: "police-locker",
});
assert.equal(titled.type, "TASK");
assert.equal(titled.priority, "LOW");
assert.equal(titled.severity, "MINOR");
assert.equal(titled.title, "Restock MRPD lockers");
assert.equal(titled.titlePlaceholder, "Placeholder only");
assert.equal(titled.resourceName, "police-locker");

const missingName = parseIssueTemplateFields({ name: "   " });
assert.equal(missingName.ok, false);
if (!missingName.ok) assert.match(missingName.error, /name is required/i);

const parsed = parseIssueTemplateFields({
  name: "Script crash",
  type: "BUG",
  priority: "URGENT",
  severity: "BLOCKER",
  body: "stack trace",
  reproductionSteps: "1. explode",
  expectedBehavior: "no explode",
  resourceName: "ox_lib",
  sortOrder: "25",
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.value.slug, "script-crash");
  assert.equal(parsed.value.priority, "URGENT");
  assert.equal(parsed.value.severity, "BLOCKER");
  assert.equal(parsed.value.resourceName, "ox_lib");
  assert.equal(parsed.value.sortOrder, 25);
}

const featureParsed = parseIssueTemplateFields({
  name: "Feature request",
  type: "FEATURE",
  severity: "BLOCKER",
  reproductionSteps: "should drop",
  resourceName: "should-drop",
});
assert.equal(featureParsed.ok, true);
if (featureParsed.ok) {
  assert.equal(featureParsed.value.severity, "MINOR");
  assert.equal(featureParsed.value.reproductionSteps, null);
  assert.equal(featureParsed.value.resourceName, null);
}

console.log("issue-templates.test.ts ok");
