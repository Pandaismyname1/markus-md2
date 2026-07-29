import { compileMd2 } from './dist/index.js';

const P = '"><img src=x onerror=alert(1)>';
const cases = [
  ['callout title',      ':::callout{title="' + P + '"}\nbody\n:::'],
  ['callout severity',   ':::callout{severity="' + P + '"}\nbody\n:::'],
  ['callout icon',       ':::callout{icon="' + P + '"}\nbody\n:::'],
  ['figure src',         ':::figure{src="' + P + '"}\ncap\n:::'],
  ['figure alt',         ':::figure{src=a.png alt="' + P + '"}\ncap\n:::'],
  ['figure link',        ':::figure{src=a.png link="' + P + '"}\ncap\n:::'],
  ['figure credit',      ':::figure{src=a.png credit="' + P + '"}\ncap\n:::'],
  ['flow node label',    ':::flow\na[' + P + ']\nb[B]\n\na -> b\n:::'],
  ['flow title',         ':::flow{title="' + P + '"}\na[A]\nb[B]\n\na -> b\n:::'],
  ['flow direction',     ':::flow{direction="' + P + '"}\na[A]\nb[B]\n\na -> b\n:::'],
  ['flow edge label',    ':::flow\na[A]\nb[B]\n\na -> b: ' + P + '\n:::'],
  ['chart label',        ':::chart{type=bar}\n' + P + ': 5\nB: 3\n:::'],
  ['chart title',        ':::chart{type=bar title="' + P + '"}\nA: 5\n:::'],
  ['chart type',         ':::chart{type="' + P + '"}\nA: 5\n:::'],
  ['annotate text',      ':::annotate-code{lang=js}\n```js\nlet a=1;\n```\n\n@1 info: ' + P + '\n:::'],
  ['annotate lang',      ':::annotate-code{lang="' + P + '"}\n```js\nlet a=1;\n```\n\n@1 info: hi\n:::'],
  ['badge label',        'x :badge[' + P + ']{severity=info} y'],
  ['badge severity',     'x :badge[b]{severity="' + P + '"} y'],
  ['badge icon',         'x :badge[b]{icon="' + P + '"} y'],
  ['jump to',            'x :jump[go]{to="' + P + '"} y'],
  ['jump to js',         'x :jump[go]{to="javascript:alert(1)"} y'],
  ['tabs id',            '::::tabs{id="' + P + '"}\n:::tab[One]\nA\n:::\n::::'],
  ['tab key',            '::::tabs\n:::tab[One]{key="' + P + '"}\nA\n:::\n::::'],
  ['tab label',          '::::tabs\n:::tab[' + P + ']\nA\n:::\n::::'],
  ['step label',         '::::steps\n:::step[' + P + ']\nA\n:::\n::::'],
  ['step status',        '::::steps\n:::step[S]{status="' + P + '"}\nA\n:::\n::::'],
  ['steps start',        '::::steps{start="' + P + '"}\n:::step[S]\nA\n:::\n::::'],
  ['columns min',        ':::columns{min="' + P + '"}\nA\n:::'],
  ['columns gap css',    ':::columns{gap="1rem; background-image: url(https://evil.example/leak)"}\nA\n:::'],
  ['columns min css',    ':::columns{min="1px; background:url(https://evil.example/x)"}\nA\n:::'],
  ['details summary',    ':::details[' + P + ']\nbody\n:::'],
  ['riskmap title',      ':::risk-map{title="' + P + '"}\n- a\n:::'],
  ['timeline label',     ':::timeline\n:::event[' + P + ']\nA\n:::\n:::'],
  ['compare option',     '::::compare\n:::option[' + P + ']\nA\n:::\n::::'],
  ['tree body',          ':::tree\n' + P + '\n:::'],
  ['figure src js',      ':::figure{src=a.png link="javascript:alert(1)"}\ncap\n:::'],
];

for (const [name, src] of cases) {
  let out;
  try { out = await compileMd2(src); } catch (e) { console.log('THROW  ' + name + ': ' + e.message); continue; }
  const bad = /<img[^>]*onerror/i.test(out) || /onerror=/i.test(out) || /<script/i.test(out);
  const js = /javascript:/i.test(out);
  const evil = /evil\.example/i.test(out);
  const flag = bad ? 'INJECT' : js ? 'JSURL ' : evil ? 'CSSURL' : 'ok    ';
  if (flag !== 'ok    ') console.log(flag + ' ' + name + '\n    ' + out.replace(/\n/g,' ').slice(0, 420) + '\n');
}
console.log('--- done ---');
