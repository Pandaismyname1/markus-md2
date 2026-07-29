const listeners = [], xhrOpens = [];
globalThis.window = globalThis; globalThis.self = globalThis;
globalThis.Element = function(){}; globalThis.Element.prototype.matches = function(){return true;};
const el = {
  matches: () => true,
  getAttribute: (a) => a === 'data-src' ? 'https://evil.example/stolen-by-import' : null,
  setAttribute: () => {}, appendChild: (c) => c, classList: { add(){}, contains(){return false}, remove(){} },
  className: '', parentElement: null, textContent: ''
};
Object.setPrototypeOf(el, globalThis.Element.prototype);
globalThis.document = {
  readyState: 'loading', currentScript: null,
  addEventListener: (ev, fn) => listeners.push([ev, fn]),
  getElementsByTagName: () => [],
  querySelectorAll: (sel) => /data-src/.test(sel) ? [el] : [],
  createElement: () => ({ setAttribute(){}, appendChild(){}, classList:{add(){},contains(){return false},remove(){}}, className:'', textContent:'' })
};
globalThis.XMLHttpRequest = class { open(m,u){ xhrOpens.push(m + ' ' + u); } send(){} };

const mod = await import('./browser/md2.js');
console.log('exports          :', Object.keys(mod).join(', '));
console.log('global Prism set :', typeof globalThis.Prism);
console.log('listeners on import:', JSON.stringify(listeners.map(l => l[0])));
console.log('--- now fire the DOMContentLoaded listener the bundle registered ---');
for (const [, fn] of listeners) { try { fn(); } catch (e) { console.log('  (handler err: ' + e.message + ')'); } }
console.log('XHR issued by auto-run:', JSON.stringify(xhrOpens));
