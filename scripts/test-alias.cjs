const Module = require('node:module');
const path = require('node:path');

const originalResolve = Module._resolveFilename;
const outRoot = path.resolve(__dirname, '..', '.tmp-test');

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const mapped = path.join(outRoot, request.slice(2));
    return originalResolve.call(this, mapped, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
