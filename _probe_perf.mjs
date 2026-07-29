import { compileMd2, compileMd2WithDiagnostics } from './dist/index.js';

async function timed(name, src, budget = 5000) {
  const t0 = Date.now();
  let res = 'ok', len = 0;
  try {
    const to = new Promise((_, rj) => setTimeout(() => rj(new Error('TIMEOUT >60s')), 60000));
    const html = await Promise.race([compileMd2(src), to]);
    len = html.length;
  } catch (e) { res = 'THROW: ' + (e && e.message ? e.message.split('\n')[0] : e); }
  const ms = Date.now() - t0;
  console.log(`${ms > budget ? 'SLOW  ' : res !== 'ok' ? 'FAIL  ' : 'ok    '} ${name.padEnd(34)} ${String(ms).padStart(7)}ms  out=${len}  ${res === 'ok' ? '' : res}`);
}

// 1. deeply nested directives, 50 levels (fence lengths grow so nesting is real)
{
  let s = '';
  const N = 50;
  for (let i = 0; i < N; i++) s += ':'.repeat(N + 3 - i) + 'callout{title=L' + i + '}\n';
  s += 'deep\n';
  for (let i = N - 1; i >= 0; i--) s += ':'.repeat(N + 3 - i) + '\n';
  await timed('50 nested callouts', s);
}
// 1b. 50 nested columns/column
{
  let s = ''; const N = 50;
  for (let i = 0; i < N; i++) s += ':'.repeat(N + 3 - i) + (i % 2 ? 'column' : 'columns') + '\n';
  s += 'deep\n';
  for (let i = N - 1; i >= 0; i--) s += ':'.repeat(N + 3 - i) + '\n';
  await timed('50 nested columns', s);
}
// 2. chart with 10000 data lines
{
  const rows = Array.from({length: 10000}, (_, i) => `L${i}: ${i % 97}`).join('\n');
  await timed('chart bar 10000 rows', ':::chart{type=bar title=T}\n' + rows + '\n:::');
  await timed('chart line 10000 rows', ':::chart{type=line title=T}\n' + rows + '\n:::');
  await timed('chart sparkline 10000 rows', ':::chart{type=sparkline}\n' + rows + '\n:::');
}
// 3. flow with cyclic edges
await timed('flow 2-cycle a->b b->a', ':::flow\na[A]\nb[B]\n\na -> b\nb -> a\n:::');
{
  const n = 200;
  const nodes = Array.from({length: n}, (_, i) => `n${i}[N${i}]`).join('\n');
  const edges = Array.from({length: n}, (_, i) => `n${i} -> n${(i+1)%n}`).join('\n');
  await timed('flow 200-node full cycle', ':::flow\n' + nodes + '\n\n' + edges + '\n:::');
}
{ // dense cycles
  const n = 60; const nodes = Array.from({length:n},(_,i)=>`n${i}[N${i}]`).join('\n');
  const edges = []; for (let i=0;i<n;i++) for (let j=0;j<n;j+=7) edges.push(`n${i} -> n${j}`);
  await timed(`flow ${n} nodes / ${edges.length} edges`, ':::flow\n' + nodes + '\n\n' + edges.join('\n') + '\n:::');
}
// 4. tree 100 levels deep
{
  const lines = Array.from({length: 100}, (_, i) => '  '.repeat(i) + '- lvl' + i).join('\n');
  await timed('tree 100 levels (list)', ':::tree\n' + lines + '\n:::');
  const lines2 = Array.from({length: 100}, (_, i) => ' '.repeat(i * 2) + 'lvl' + i).join('\n');
  await timed('tree 100 levels (indent)', ':::tree\n' + lines2 + '\n:::');
}
// 5. annotate-code reversed / absurd ranges
await timed('annotate reversed range', ':::annotate-code{lang=js}\n```js\nlet a=1;\n```\n\n@9-1 info: x\n:::');
await timed('annotate absurd range 1-1e9', ':::annotate-code{lang=js}\n```js\nlet a=1;\n```\n\n@1-1000000000 blocking: boom\n:::');
await timed('annotate range 1e9-1e9+1', ':::annotate-code{lang=js}\n```js\nlet a=1;\n```\n\n@999999999-1000000000 nit: x\n:::');
console.log('--- done ---');
