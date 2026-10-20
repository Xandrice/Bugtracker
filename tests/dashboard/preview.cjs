/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI fixture; no application credentials or databases. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('../../node_modules/.cache/issue-test-tools/node_modules/esbuild');
const { root } = require('../issues/load-ts.cjs');
async function main() {
  const bundle = await build({ entryPoints: [path.join(__dirname, 'preview.jsx')], bundle: true, write: false, jsx: 'automatic', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'fixture-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/app\/logs\/actions)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
      const contents = args.path === 'next/link' ? 'import React from "react"; export default function Link({children,prefetch,scroll,replace,...props}) { return React.createElement("a",props,children); }' : args.path === 'next/navigation' ? 'export function useRouter(){return window.logRouter;} export function usePathname(){return "/logs";}' : 'export async function searchLogsAction(...args){return window.logFixture.search(...args);} export async function searchLogPlayers(){return [{id:"82258",name:"Skyla Tretyakova"}];}';
      return { contents, loader: 'jsx', resolveDir: root };
    });
  } }] });
  const chunks = path.join(root,'.next/static/chunks');
  const styles = fs.readdirSync(chunks).filter(file => file.endsWith('.css')).map(file => fs.readFileSync(path.join(chunks,file),'utf8')).join('\n');
  http.createServer((request,response) => {
    if (request.url === '/bundle.js') { response.setHeader('Content-Type','text/javascript'); response.end(bundle.outputFiles[0].text); }
    else if (request.url === '/style.css') { response.setHeader('Content-Type','text/css'); response.end(styles); }
    else if (request.url.startsWith('/api/logs/export')) { response.setHeader('Content-Type','text/csv'); response.end('time,event\n2026-10-04T21:00:00Z,Money received'); }
    else { response.setHeader('Content-Type','text/html'); response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  }).listen(3101,'127.0.0.1',() => console.log('Isolated Moderator logs fixture: http://localhost:3101/logs'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
