const fs = require('fs');
const parser = require('@babel/parser');
const diff = require('diff');

function parseCode(code) {
  return parser.parse(code, {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      'classProperties',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
      'objectRestSpread',
      'decorators-legacy',
      'topLevelAwait'
    ]
  });
}

function normalize(node) {
  if (!node || typeof node !== 'object' || !node.type) return null;

  if (node.type === 'Identifier') return { type: 'Identifier' };
  if ([
    'NumericLiteral',
    'StringLiteral',
    'BooleanLiteral',
    'NullLiteral',
    'Literal'
  ].includes(node.type)) return { type: 'Literal' };

  const out = { type: node.type };

  if (node.type && node.type.startsWith('Function')) {
    out.params = node.params?.length || 0;
    out.async = !!node.async;
    out.generator = !!node.generator;
  }

  if (node.type === 'CallExpression') {
    out.calleeType = node.callee?.type || null;
    out.argumentsCount = node.arguments?.length || 0;
  }

  if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    out.operator = node.operator;
  }

  for (const key of Object.keys(node)) {
    if (['type', 'start', 'end', 'loc', 'range', 'extra',
         'raw', 'leadingComments', 'trailingComments'].includes(key)) continue;

    const val = node[key];
    if (Array.isArray(val)) {
      out[key] = val.map(normalize).filter(Boolean);
    } else if (val && typeof val === 'object') {
      const child = normalize(val);
      if (child) out[key] = child;
    } else {
      out[key] = val;
    }
  }
  return out;
}

// 以下は前のコードと同じ
function collectEntities(ast) {
  const entities = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    switch (node.type) {
      case 'FunctionDeclaration':
        entities.push({ kind: 'function', name: node.id?.name, sig: JSON.stringify(normalize(node)) });
        break;
      case 'VariableDeclaration':
        for (const decl of node.declarations || []) {
          entities.push({ kind: 'variable', name: decl.id?.name, sig: JSON.stringify(normalize(decl.init)) });
        }
        break;
      case 'ClassDeclaration':
        entities.push({ kind: 'class', name: node.id?.name, sig: JSON.stringify(normalize(node)) });
        break;
    }
    for (const k of Object.keys(node)) {
      if (['type','start','end','loc','range'].includes(k)) continue;
      const child = node[k];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  }
  visit(ast);
  return entities;
}

function makeMap(entities) {
  const map = new Map();
  let anon = 0;
  for (const e of entities) {
    let key = e.name || `<anon:${e.kind}:${anon++}>`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

function compareMaps(a, b) {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  const result = { added: [], removed: [], modified: [], unchanged: [] };
  for (const key of allKeys) {
    const aList = a.get(key) || [];
    const bList = b.get(key) || [];
    if (aList.length === 0) { result.added.push({ key, items: bList }); continue; }
    if (bList.length === 0) { result.removed.push({ key, items: aList }); continue; }
    if (aList[0].sig === bList[0].sig) result.unchanged.push({ key });
    else result.modified.push({ key, patch: diff.createPatch(key, aList[0].sig, bList[0].sig, 'original', 'new') });
  }
  return result;
}

function printReport(r) {
  if (r.added.length) r.added.forEach(it => console.log('+', it.key));
  if (r.removed.length) r.removed.forEach(it => console.log('-', it.key));
  if (r.modified.length) r.modified.forEach(m => {
    console.log('~', m.key);
    process.stdout.write(m.patch);
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node diff.js <original.js> <new.js>');
    process.exit(1);
  }
  const [oPath, nPath] = args;
  const orig = fs.readFileSync(oPath, 'utf8');
  const mod = fs.readFileSync(nPath, 'utf8');
  const astA = parseCode(orig);
  const astB = parseCode(mod);
  const mapA = makeMap(collectEntities(astA));
  const mapB = makeMap(collectEntities(astB));
  const report = compareMaps(mapA, mapB);
  printReport(report);
  if (report.added.length || report.removed.length || report.modified.length) process.exit(2);
  else process.exit(0);
}

main();
