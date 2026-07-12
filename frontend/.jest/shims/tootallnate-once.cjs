// CJS shim of @tootallnate/once. Only used for Jest test runs on Node 22
// to avoid an ESM/CJS interop crash pulled in via jsdom → http-proxy-agent.
'use strict';

function once(emitter, name, options) {
  const signal = options && options.signal;
  return new Promise((resolve, reject) => {
    function cleanup() {
      if (signal) signal.removeEventListener('abort', onAbort);
      emitter.removeListener(name, onEvent);
      emitter.removeListener('error', onError);
    }
    function onEvent(...args) {
      cleanup();
      resolve(args);
    }
    function onError(err) {
      cleanup();
      reject(err);
    }
    function onAbort() {
      cleanup();
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    }
    if (signal && signal.aborted) {
      onAbort();
      return;
    }
    if (signal) signal.addEventListener('abort', onAbort);
    emitter.on(name, onEvent);
    emitter.on('error', onError);
  });
}

module.exports = once;
module.exports.default = once;
