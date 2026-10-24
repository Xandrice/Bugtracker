/* eslint-disable @typescript-eslint/no-require-imports -- Node browser harness uses CommonJS. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { root } = require('../issues/load-ts.cjs');
const { build } = require('../../node_modules/.cache/issue-test-tools/node_modules/esbuild');
const { chromium } = require('../../node_modules/.cache/issue-test-tools/node_modules/playwright');

async function main() {
  const bundle = await build({ entryPoints: [path.join(__dirname, 'browser-fixture.jsx')], bundle: true, write: false, jsx: 'automatic', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'boundaries', setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|\.\/actions)$/ }, (args) => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: args.path === 'next/link' ? 'import React from "react"; export default function Link(props) { return React.createElement("a",props); }' : args.path === 'next/navigation' ? 'export function useRouter(){return window.roadmapRouter;}' : ['saveRoadmapMilestone', 'deleteRoadmapMilestone', 'searchRoadmapIssues'].map((name) => `export async function ${name}(...args){return window.roadmapTest.${name}(...args);}`).join('\n'), loader: 'jsx', resolveDir: root }));
  } }] });
  const chunks = path.join(root, '.next/static/chunks');
  const styles = fs.readdirSync(chunks).filter((file) => file.endsWith('.css')).map((file) => fs.readFileSync(path.join(chunks, file), 'utf8')).join('\n');
  assert.ok(styles, 'Run npm run build before browser checks.');
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(styles); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, timezoneId: 'America/Los_Angeles' });
    // UTC is already the 24th; the calendar should still highlight the 23rd locally.
    await page.clock.install({ time: new Date('2026-10-24T01:00:00Z') });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    const output = path.join(root, '.next/roadmap-checks');
    fs.mkdirSync(output, { recursive: true });
    await page.goto(base);
    await page.getByRole('heading', { name: 'October 2026' }).waitFor();
    assert.equal(await page.locator('[data-calendar-day="2026-10-23"]').getByLabel('Today', { exact: true }).count(), 1);
    assert.equal(await page.locator('[data-calendar-day="2026-10-28"]').getByRole('button', { name: 'Economy update' }).count(), 1);
    await page.screenshot({ path: path.join(output, 'calendar.png'), fullPage: true });
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('heading', { name: 'November 2026' }).waitFor();
    await page.locator('[data-calendar-day="2026-11-02"]').getByRole('button', { name: 'Server launch' }).waitFor();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByLabel('Jump to month').fill('2027-01');
    await page.getByRole('heading', { name: 'January 2027' }).waitFor();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByLabel('Add milestone on 2026-10-30').click();
    assert.equal(await page.getByLabel('Target date', { exact: true }).inputValue(), '2026-10-30');
    await page.getByLabel('Milestone name').fill('Vehicle update');
    await page.getByLabel('Status', { exact: true }).selectOption('IN_PROGRESS');
    await page.getByLabel('Linked issues (0/100)').fill('payout');
    await page.getByRole('button', { name: /ECO-1.*Balance payouts/ }).click();
    await page.evaluate(() => { window.failSave = true; });
    await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Simulated save failure' }).waitFor();
    assert.equal(await page.getByLabel('Milestone name').inputValue(), 'Vehicle update');
    assert.equal(await page.getByRole('link', { name: /Balance payouts/ }).count(), 1);
    await page.evaluate(() => { window.failSave = false; });
    await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.locator('[data-calendar-day="2026-10-30"]').getByRole('button', { name: 'Vehicle update', exact: true }).click();
    assert.equal(await page.getByLabel('Status', { exact: true }).inputValue(), 'IN_PROGRESS');
    await page.getByLabel('Target date', { exact: true }).fill('');
    await page.getByLabel('Remove Balance payouts').click();
    await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('region', { name: 'Unscheduled milestones' }).getByRole('button', { name: /Vehicle update/ }).waitFor();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.getByLabel('Search milestones').fill('Vehicle');
    assert.equal(await page.getByRole('region', { name: 'Milestone list' }).getByRole('button').count(), 1);
    await page.getByRole('button', { name: /Vehicle update/ }).click();
    await page.getByRole('button', { name: 'Delete milestone', exact: true }).click();
    await page.getByRole('button', { name: 'Keep milestone' }).click();
    await page.getByRole('button', { name: 'Delete milestone', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByText('No milestones match your search and status filter.').waitFor();
    await page.getByLabel('Search milestones').fill('');
    await page.getByLabel('Filter milestone status').click();
    await page.getByRole('option', { name: 'In progress', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Milestone list' }).getByRole('button').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'New milestone', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Editor fits narrow viewport');
    const bounds = await page.getByRole('dialog').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 392, 'Dialog stays within viewport');
    await page.screenshot({ path: path.join(output, 'mobile-editor.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Calendar scrolls inside its container');
    await page.screenshot({ path: path.join(output, 'mobile-calendar.png'), fullPage: true });
    await page.goto(`${base}/?readonly`);
    assert.equal(await page.getByRole('button', { name: 'New milestone', exact: true }).count(), 0);
    await page.locator('[data-calendar-day="2026-10-28"]').getByRole('button', { name: 'Economy update', exact: true }).click();
    await page.getByRole('heading', { name: 'Milestone details' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save milestone', exact: true }).count(), 0);
    await page.getByRole('link', { name: /Balance payouts/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Roadmap browser checks passed: navigation, date prefills, status, issue links, failed save recovery, rescheduling, unlinking, filters, deletion, mobile layout, and read-only details.');
  } finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
