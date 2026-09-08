/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { root } = require('./load-ts.cjs');
const { build } = require('../../node_modules/.cache/issue-test-tools/node_modules/esbuild');
const { chromium } = require('../../node_modules/.cache/issue-test-tools/node_modules/playwright');

async function main() {
  const bundle = await build({ entryPoints: [path.join(__dirname, 'browser-fixture.jsx')], bundle: true, write: false, jsx: 'automatic', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'test-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/app\/actions|@\/app\/staff-actions|@\/app\/issue-list-actions)$/ }, (args) => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => {
      let contents;
      if (args.path === 'next/link') contents = 'import React from "react"; export default function Link({children,prefetch,scroll,replace,...props}) { return React.createElement("a",props,children); }';
      else if (args.path === 'next/navigation') contents = 'export function useRouter(){return window.issueRouter;} export function usePathname(){return location.pathname;}';
      else contents = ['createIssue', 'saveIssueDetails', 'updateIssueWorkflow', 'updateIssueAssignee', 'bulkUpdateIssues', 'loadIssueChildren', 'saveSavedView', 'deleteSavedView'].map((name) => `export async function ${name}(...args){return window.issueTest.${name}(...args);}`).join('\n');
      return { contents, loader: 'jsx', resolveDir: root };
    });
  } }] });
  const chunks = path.join(root, '.next/static/chunks');
  const styles = fs.existsSync(chunks) ? fs.readdirSync(chunks).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(chunks, f), 'utf8')).join('\n') : '';
  assert.ok(styles, 'Run npm run build before browser checks to use the real production styles.');
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(styles); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/forms`);
    await page.getByLabel('Title', { exact: true }).fill('My unfinished report');
    await page.getByRole('button', { name: 'Issue template', exact: true }).click();
    await page.getByRole('option', { name: /Bug template/ }).click();
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'My unfinished report');
    assert.equal(await page.getByLabel('Description', { exact: true }).inputValue(), 'Template body');
    await page.getByLabel('Title', { exact: true }).fill(' ');
    await page.getByRole('button', { name: 'Create issue', exact: true }).click();
    await page.getByText('Enter a title.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Description', { exact: true }).inputValue(), 'Template body');
    await page.getByRole('button', { name: 'Submit second' }).click();
    await page.getByText('Second title error', { exact: true }).waitFor();
    const errorIds = await page.locator('[role=alert][id]').evaluateAll((elements) => elements.map((element) => element.id));
    assert.equal(new Set(errorIds).size, 2);
    assert.equal(await page.getByLabel('Second title').inputValue(), 'keep me');
    await page.getByLabel('Title', { exact: true }).fill('Keep this edit');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Replace edited fields with template' }).click();
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Keep this edit');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Replace edited fields with template' }).click();
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Template title');
    await page.goto(`${base}/issues`);
    assert.equal(await page.getByRole('checkbox', { name: 'Select context-parent', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Expand subtasks for parent', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Select child-one', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select child-two', exact: true }).check();
    await page.getByLabel('Bulk status', { exact: true }).selectOption('REVIEW');
    await page.getByRole('button', { name: 'Apply to selected' }).click();
    await page.getByText(/1 updated; 1 failed/).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Status for child-one"]')?.value === 'REVIEW');
    assert.equal(await page.getByRole('checkbox', { name: 'Select child-two', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'Select child-one', exact: true }).isChecked(), false);
    await page.evaluate(() => { window.failUpdate = true; });
    await page.getByLabel('Status for child-two', { exact: true }).selectOption('DONE');
    await page.getByText('Simulated update failed', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Status for child-two', { exact: true }).inputValue(), 'OPEN');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('link', { name: 'next-parent', exact: true }).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    await page.goBack();
    await page.getByRole('button', { name: 'Expand subtasks for parent', exact: true }).waitFor();
    await page.getByLabel('Search issue titles and keys').fill('police');
    await page.getByLabel('Search issue titles and keys').press('Enter');
    await page.waitForURL(/q=police/);
    await page.getByLabel('Saved view name').fill('Police bugs');
    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    await page.getByRole('button', { name: 'Delete saved view Police bugs' }).waitFor();
    await page.getByRole('button', { name: 'Delete saved view Police bugs' }).click();
    assert.equal(await page.getByRole('button', { name: 'Police bugs', exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/forms`);
    await page.getByLabel('Title', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The form must fit a narrow viewport.');
    await page.getByLabel('Title', { exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
    fs.mkdirSync(path.join(root, '.next/issue-checks'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.next/issue-checks/mobile-form.png'), fullPage: true });
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${base}/issues`);
    await page.getByRole('button', { name: 'Expand subtasks for parent', exact: true }).click();
    await page.screenshot({ path: path.join(root, '.next/issue-checks/issue-table.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: draft preservation, validation recovery, unique form errors, template replacement, context selection, bulk failure recovery, refreshed subtasks, pagination, history, search, saved views, mobile form, keyboard focus.');
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
