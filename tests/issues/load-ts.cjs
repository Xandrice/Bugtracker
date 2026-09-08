/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

// Compile in memory and inject infrastructure at module boundaries. No app DB is contacted.
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    function resolve(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const base = specifier.startsWith('@/') ? path.resolve(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(absolute), specifier);
        const relative = path.relative(root, base).replaceAll('\\', '/');
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of ['.ts', '.tsx', '']) if (fs.existsSync(base + extension) && fs.statSync(base + extension).isFile()) return load(base + extension);
      }
      return require(specifier);
    }
    new Function('require', 'module', 'exports', output)(resolve, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
module.exports = { loader, root };
