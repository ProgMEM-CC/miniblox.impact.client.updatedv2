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

  if (node.type === 'Identifier') return { type: 'Identifier', name: node.name };
  if ([
    'NumericLiteral',
    'StringLiteral',
    'BooleanLiteral',
    'NullLiteral',
    'Literal'
  ].includes(node.type)) return { type: 'Literal', value: node.value };

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

function collectEntities(ast, sourceCode = '') {
  const entities = [];

  function visit(node, path = '') {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'FunctionDeclaration':
        const funcName = node.id?.name || '<anonymous>';
        // Extract source code snippet for functions
        let sourceSnippet = '';
        if (sourceCode && node.start !== undefined && node.end !== undefined) {
          const fullSource = sourceCode.slice(node.start, node.end);
          // Get just the function signature (first line)
          sourceSnippet = fullSource.split('\n')[0].trim();
          if (sourceSnippet.length > 100) {
            sourceSnippet = sourceSnippet.substring(0, 100) + '...';
          }
        }

        entities.push({
          kind: 'function',
          name: funcName,
          details: {
            async: node.async,
            generator: node.generator,
            params: node.params?.length || 0,
            sourceSnippet: sourceSnippet
          },
          sig: JSON.stringify(normalize(node))
        });
        break;

      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        entities.push({
          kind: 'arrow-function',
          name: `<${node.type}>`,
          details: {
            async: node.async,
            params: node.params?.length || 0
          },
          sig: JSON.stringify(normalize(node))
        });
        break;

      case 'VariableDeclaration':
        for (const decl of node.declarations || []) {
          const varName = decl.id?.name || '<anonymous>';
          const initValue = decl.init ? normalize(decl.init) : null;
          // Extract source code snippet for variables
          let sourceSnippet = '';
          if (sourceCode && node.start !== undefined && node.end !== undefined) {
            sourceSnippet = sourceCode.slice(node.start, node.end).trim();
          }

          entities.push({
            kind: 'variable',
            name: varName,
            details: {
              declarationType: node.kind, // let, const, var
              hasInitializer: !!decl.init,
              initType: decl.init?.type || null,
              sourceSnippet: sourceSnippet
            },
            sig: JSON.stringify({
              type: 'VariableDeclarator',
              kind: node.kind,
              init: initValue
            })
          });
        }
        break;

      case 'ClassDeclaration':
        entities.push({
          kind: 'class',
          name: node.id?.name || '<anonymous>',
          details: {
            hasSuper: !!node.superClass,
            methodCount: node.body?.body?.length || 0
          },
          sig: JSON.stringify(normalize(node))
        });
        break;

      case 'MethodDefinition':
        entities.push({
          kind: 'method',
          name: `${path}.${node.key?.name || '<computed>'}`,
          details: {
            static: node.static,
            kind: node.kind, // method, constructor, get, set
            async: node.value?.async,
            params: node.value?.params?.length || 0
          },
          sig: JSON.stringify(normalize(node))
        });
        break;

      case 'ExpressionStatement':
        if (node.expression?.type === 'CallExpression') {
          const callee = node.expression.callee;
          if (callee?.object?.name === 'console' && callee?.property?.name === 'log') {
            const args = node.expression.arguments || [];
            // Extract console.log content
            let logContent = '';
            if (sourceCode && node.start !== undefined && node.end !== undefined) {
              logContent = sourceCode.slice(node.start, node.end).trim();
              if (logContent.length > 150) {
                logContent = logContent.substring(0, 150) + '...';
              }
            }

            entities.push({
              kind: 'console.log',
              name: '<console.log>',
              details: {
                argumentCount: args.length,
                firstArg: args[0]?.type || null,
                logContent: logContent
              },
              sig: JSON.stringify(normalize(node.expression))
            });
          } else {
            // Other function calls - better name detection
            let callName = 'unknown';
            if (callee?.type === 'Identifier') {
              callName = callee.name;
            } else if (callee?.type === 'MemberExpression') {
              const objName = callee.object?.name || 'obj';
              const propName = callee.property?.name || 'prop';
              callName = `${objName}.${propName}`;
            } else if (callee?.type === 'CallExpression') {
              callName = 'chained-call';
            } else if (callee?.type === 'FunctionExpression' || callee?.type === 'ArrowFunctionExpression') {
              callName = 'anonymous-function';
            }

            entities.push({
              kind: 'function-call',
              name: `<call:${callName}>`,
              details: {
                argumentCount: node.expression.arguments?.length || 0,
                calleeType: callee?.type || 'unknown'
              },
              sig: JSON.stringify(normalize(node.expression))
            });
          }
        } else if (node.expression?.type === 'AssignmentExpression') {
          entities.push({
            kind: 'assignment',
            name: `<assignment:${node.expression.left?.name || 'complex'}>`,
            details: {
              operator: node.expression.operator
            },
            sig: JSON.stringify(normalize(node.expression))
          });
        }
        break;

      case 'ImportDeclaration':
        entities.push({
          kind: 'import',
          name: `<import:${node.source?.value || 'unknown'}>`,
          details: {
            specifierCount: node.specifiers?.length || 0,
            isDefault: node.specifiers?.some(s => s.type === 'ImportDefaultSpecifier')
          },
          sig: JSON.stringify(normalize(node))
        });
        break;

      case 'ExportDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportNamedDeclaration':
        entities.push({
          kind: 'export',
          name: `<export:${node.declaration?.id?.name || node.declaration?.type || 'unknown'}>`,
          details: {
            isDefault: node.type === 'ExportDefaultDeclaration'
          },
          sig: JSON.stringify(normalize(node))
        });
        break;
    }

    // Recursively visit child nodes
    for (const key of Object.keys(node)) {
      if (['type', 'start', 'end', 'loc', 'range', 'leadingComments', 'trailingComments'].includes(key)) continue;

      const child = node[key];
      const newPath = node.type === 'ClassDeclaration' ? node.id?.name || '<class>' : path;

      if (Array.isArray(child)) {
        child.forEach(c => visit(c, newPath));
      } else if (child && typeof child === 'object') {
        visit(child, newPath);
      }
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

function formatDetails(entity) {
  if (!entity.details) return '';

  const details = [];
  const d = entity.details;

  switch (entity.kind) {
    case 'function':
      if (d.async) details.push('async');
      if (d.generator) details.push('generator');
      details.push(`${d.params} params`);
      break;

    case 'variable':
      details.push(d.declarationType);
      if (d.hasInitializer) details.push(`= ${d.initType}`);
      break;

    case 'class':
      if (d.hasSuper) details.push('extends');
      details.push(`${d.methodCount} methods`);
      break;

    case 'method':
      if (d.static) details.push('static');
      if (d.async) details.push('async');
      details.push(d.kind);
      details.push(`${d.params} params`);
      break;

    case 'console.log':
      details.push(`${d.argumentCount} args`);
      if (d.firstArg) details.push(`first: ${d.firstArg}`);
      break;

    case 'function-call':
      details.push(`${d.argumentCount} args`);
      break;

    case 'assignment':
      details.push(d.operator);
      break;

    case 'import':
      details.push(`${d.specifierCount} imports`);
      if (d.isDefault) details.push('default');
      break;

    case 'export':
      if (d.isDefault) details.push('default');
      break;
  }

  return details.length > 0 ? ` [${details.join(', ')}]` : '';
}

function getEntityIcon(kind) {
  const icons = {
    'function': '🔧',
    'arrow-function': '➡️',
    'variable': '📦',
    'class': '🏗️',
    'method': '⚙️',
    'console.log': '📝',
    'function-call': '📞',
    'assignment': '📝',
    'import': '📥',
    'export': '📤'
  };
  return icons[kind] || '❓';
}

function compareMaps(a, b) {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  const result = { added: [], removed: [], modified: [], unchanged: [] };
  for (const key of allKeys) {
    const aList = a.get(key) || [];
    const bList = b.get(key) || [];
    if (aList.length === 0) {
      result.added.push({ key, items: bList, newEntity: bList[0] });
      continue;
    }
    if (bList.length === 0) {
      result.removed.push({ key, items: aList, oldEntity: aList[0] });
      continue;
    }
    if (aList[0].sig === bList[0].sig) {
      result.unchanged.push({ key });
    } else {
      result.modified.push({
        key,
        oldEntity: aList[0],
        newEntity: bList[0],
        patch: diff.createPatch(key, aList[0].sig, bList[0].sig, 'original', 'new')
      });
    }
  }
  return result;
}

function printReport(r) {
  console.log('\n📊 JavaScript Code Diff Report');
  console.log('═'.repeat(70));

  const totalChanges = r.added.length + r.removed.length + r.modified.length;
  console.log(`📈 Summary: +${r.added.length} added, -${r.removed.length} removed, ~${r.modified.length} modified, =${r.unchanged.length} unchanged\n`);

  if (r.added.length) {
    console.log('🟢 ADDED ITEMS:');
    console.log('─'.repeat(40));
    r.added.forEach((it, index) => {
      const entity = it.items[0];
      const icon = getEntityIcon(entity?.kind);
      const details = formatDetails(entity);
      console.log(`${index + 1}. ${icon} ${it.key}${details}`);

      // Show detailed information based on entity type
      if (entity?.kind === 'variable' && entity.sig) {
        try {
          const parsed = JSON.parse(entity.sig);
          console.log(`   📋 Type: ${entity.details.declarationType} variable`);
          if (parsed.init?.value !== undefined) {
            const value = typeof parsed.init.value === 'string'
              ? `"${parsed.init.value}"`
              : String(parsed.init.value);
            console.log(`   💡 Value: ${value}`);
          } else if (parsed.init?.type) {
            console.log(`   🔗 Initialized with: ${parsed.init.type}`);
          }

          // Show source snippet in verbose mode
          if (r.verbose && entity.details.sourceSnippet) {
            console.log(`   📄 Source: ${entity.details.sourceSnippet}`);
          }
        } catch (e) {
          console.log(`   ⚠️  Complex initialization`);
        }
      } else if (entity?.kind === 'function') {
        console.log(`   📋 Type: Function declaration`);
        console.log(`   📝 Parameters: ${entity.details.params}`);
        if (entity.details.async) console.log(`   ⚡ Async function`);
        if (entity.details.generator) console.log(`   🔄 Generator function`);

        // Show source snippet in verbose mode
        if (r.verbose && entity.details.sourceSnippet) {
          console.log(`   📄 Source: ${entity.details.sourceSnippet}`);
        }
      } else if (entity?.kind === 'console.log') {
        console.log(`   📋 Type: Console log statement`);
        console.log(`   📝 Arguments: ${entity.details.argumentCount}`);
        if (entity.details.firstArg) {
          console.log(`   🎯 First argument type: ${entity.details.firstArg}`);
        }

        // Show log content in verbose mode
        if (r.verbose && entity.details.logContent) {
          console.log(`   📄 Content: ${entity.details.logContent}`);
        }
      } else if (entity?.kind === 'function-call') {
        console.log(`   📋 Type: Function call`);
        console.log(`   📝 Arguments: ${entity.details.argumentCount}`);
        console.log(`   🎯 Callee type: ${entity.details.calleeType}`);
      }
      console.log();
    });
  }

  if (r.removed.length) {
    console.log('🔴 REMOVED ITEMS:');
    console.log('─'.repeat(40));
    r.removed.forEach((it, index) => {
      const entity = it.items[0];
      const icon = getEntityIcon(entity?.kind);
      const details = formatDetails(entity);
      console.log(`${index + 1}. ${icon} ${it.key}${details}`);

      if (entity?.kind === 'variable') {
        console.log(`   📋 Was: ${entity.details.declarationType} variable`);
      } else if (entity?.kind === 'function') {
        console.log(`   📋 Was: Function with ${entity.details.params} parameters`);
      }
      console.log();
    });
  }

  if (r.modified.length) {
    console.log('🟡 MODIFIED ITEMS:');
    console.log('─'.repeat(40));
    r.modified.forEach((m, index) => {
      console.log(`${index + 1}. 🔄 ${m.key}`);

      // Show specific changes for variables
      if (m.oldEntity?.kind === 'variable' && m.newEntity?.kind === 'variable') {
        console.log(`   📋 Type: Variable modification`);

        try {
          const oldParsed = JSON.parse(m.oldEntity.sig);
          const newParsed = JSON.parse(m.newEntity.sig);

          if (oldParsed.init?.value !== newParsed.init?.value) {
            const oldValue = oldParsed.init?.value !== undefined
              ? (typeof oldParsed.init.value === 'string' ? `"${oldParsed.init.value}"` : String(oldParsed.init.value))
              : 'undefined';
            const newValue = newParsed.init?.value !== undefined
              ? (typeof newParsed.init.value === 'string' ? `"${newParsed.init.value}"` : String(newParsed.init.value))
              : 'undefined';
            console.log(`   🔄 Value changed: ${oldValue} → ${newValue}`);
          }

          if (oldParsed.kind !== newParsed.kind) {
            console.log(`   🔄 Declaration type: ${oldParsed.kind} → ${newParsed.kind}`);
          }

          // Show source changes in verbose mode
          if (r.verbose) {
            const oldSource = m.oldEntity.details?.sourceSnippet;
            const newSource = m.newEntity.details?.sourceSnippet;
            if (oldSource && newSource && oldSource !== newSource) {
              console.log(`   📄 Old: ${oldSource}`);
              console.log(`   📄 New: ${newSource}`);
            }
          }
        } catch (e) {
          console.log(`   📝 Complex variable changes detected`);
        }
      } else if (m.oldEntity?.kind === 'console.log' && m.newEntity?.kind === 'console.log') {
        console.log(`   📋 Type: Console.log modification`);
        const oldArgs = m.oldEntity.details.argumentCount;
        const newArgs = m.newEntity.details.argumentCount;
        if (oldArgs !== newArgs) {
          console.log(`   🔄 Arguments changed: ${oldArgs} → ${newArgs}`);
        }
        if (m.oldEntity.details.firstArg !== m.newEntity.details.firstArg) {
          console.log(`   🔄 First argument type: ${m.oldEntity.details.firstArg} → ${m.newEntity.details.firstArg}`);
        }

        // Show log content changes in verbose mode
        if (r.verbose) {
          const oldContent = m.oldEntity.details?.logContent;
          const newContent = m.newEntity.details?.logContent;
          if (oldContent && newContent && oldContent !== newContent) {
            console.log(`   📄 Old: ${oldContent}`);
            console.log(`   📄 New: ${newContent}`);
          }
        }
      } else if (m.oldEntity?.kind === 'function-call' && m.newEntity?.kind === 'function-call') {
        console.log(`   📋 Type: Function call modification`);
        const oldArgs = m.oldEntity.details.argumentCount;
        const newArgs = m.newEntity.details.argumentCount;
        if (oldArgs !== newArgs) {
          console.log(`   🔄 Arguments changed: ${oldArgs} → ${newArgs}`);
        }
        console.log(`   📞 Function call structure modified`)
      } else {
        console.log(`   📝 Code structure has changed`);
        console.log(`   📋 Old type: ${m.oldEntity?.kind || 'unknown'}`);
        console.log(`   📋 New type: ${m.newEntity?.kind || 'unknown'}`);

        // Show function details if applicable
        if (m.oldEntity?.kind === 'function' && m.newEntity?.kind === 'function') {
          const oldParams = m.oldEntity.details?.params || 0;
          const newParams = m.newEntity.details?.params || 0;
          if (oldParams !== newParams) {
            console.log(`   🔄 Parameters changed: ${oldParams} → ${newParams}`);
          }

          // Show async/generator changes
          if (m.oldEntity.details?.async !== m.newEntity.details?.async) {
            console.log(`   🔄 Async status: ${m.oldEntity.details?.async ? 'async' : 'sync'} → ${m.newEntity.details?.async ? 'async' : 'sync'}`);
          }

          if (m.oldEntity.details?.generator !== m.newEntity.details?.generator) {
            console.log(`   🔄 Generator status: ${m.oldEntity.details?.generator ? 'generator' : 'normal'} → ${m.newEntity.details?.generator ? 'generator' : 'normal'}`);
          }

          // Show source changes in verbose mode
          if (r.verbose) {
            const oldSource = m.oldEntity.details?.sourceSnippet;
            const newSource = m.newEntity.details?.sourceSnippet;
            if (oldSource && newSource && oldSource !== newSource) {
              console.log(`   📄 Old: ${oldSource}`);
              console.log(`   📄 New: ${newSource}`);
            }
          }
        }

        // Show a simplified diff for other types
        if (m.patch) {
          const lines = m.patch.split('\n');
          const diffLines = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
          if (diffLines.length > 0 && diffLines.length <= 4) {
            console.log(`   🔍 ${diffLines.length} structural changes detected`);
          } else {
            console.log(`   📊 Complex changes detected (${diffLines.length} modifications)`);
          }
        }
      }
      console.log();
    });
  }

  if (r.unchanged.length > 0) {
    console.log('✅ UNCHANGED ITEMS:');
    console.log('─'.repeat(40));
    console.log(`   📊 ${r.unchanged.length} items remain identical`);

    // Show a few examples of unchanged items
    const examples = r.unchanged.slice(0, 5);
    if (examples.length > 0) {
      console.log(`   📝 Examples: ${examples.map(u => u.key).join(', ')}`);
      if (r.unchanged.length > 5) {
        console.log(`   ... and ${r.unchanged.length - 5} more`);
      }
    }
    console.log();
  }

  if (totalChanges === 0) {
    console.log('🎉 No changes detected! Files are identical.');
  } else {
    console.log(`📊 Total impact: ${totalChanges} changes detected`);
  }

  console.log('═'.repeat(70));
}

function getFileStats(content) {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  const commentLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  });

  return {
    totalLines: lines.length,
    nonEmptyLines: nonEmptyLines.length,
    commentLines: commentLines.length,
    codeLines: nonEmptyLines.length - commentLines.length,
    fileSize: Buffer.byteLength(content, 'utf8')
  };
}

function printFileComparison(origPath, newPath, origContent, newContent) {
  const origStats = getFileStats(origContent);
  const newStats = getFileStats(newContent);

  console.log('\n📁 File Comparison:');
  console.log('─'.repeat(50));
  console.log(`📄 Original: ${origPath}`);
  console.log(`   📏 Size: ${origStats.fileSize} bytes`);
  console.log(`   📊 Lines: ${origStats.totalLines} total, ${origStats.codeLines} code, ${origStats.commentLines} comments`);

  console.log(`📄 New: ${newPath}`);
  console.log(`   📏 Size: ${newStats.fileSize} bytes (${newStats.fileSize > origStats.fileSize ? '+' : ''}${newStats.fileSize - origStats.fileSize})`);
  console.log(`   📊 Lines: ${newStats.totalLines} total (${newStats.totalLines > origStats.totalLines ? '+' : ''}${newStats.totalLines - origStats.totalLines}), ${newStats.codeLines} code (${newStats.codeLines > origStats.codeLines ? '+' : ''}${newStats.codeLines - origStats.codeLines}), ${newStats.commentLines} comments (${newStats.commentLines > origStats.commentLines ? '+' : ''}${newStats.commentLines - origStats.commentLines})`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node diff.js <original.js> <new.js>');
    console.error('Options:');
    console.error('  --verbose, -v    Show detailed source code snippets');
    console.error('  --stats, -s      Show detailed file statistics');
    process.exit(1);
  }

  const flags = args.filter(arg => arg.startsWith('-'));
  const files = args.filter(arg => !arg.startsWith('-'));

  if (files.length < 2) {
    console.error('Error: Please provide two files to compare');
    process.exit(1);
  }

  const [oPath, nPath] = files;
  const verbose = flags.includes('--verbose') || flags.includes('-v');
  const showStats = flags.includes('--stats') || flags.includes('-s');

  try {
    const orig = fs.readFileSync(oPath, 'utf8');
    const mod = fs.readFileSync(nPath, 'utf8');

    if (showStats) {
      printFileComparison(oPath, nPath, orig, mod);
    }

    const astA = parseCode(orig);
    const astB = parseCode(mod);
    const entitiesA = collectEntities(astA, orig);
    const entitiesB = collectEntities(astB, mod);
    const mapA = makeMap(entitiesA);
    const mapB = makeMap(entitiesB);
    const report = compareMaps(mapA, mapB);

    // Add verbose flag to report
    report.verbose = verbose;

    printReport(report);

    if (report.added.length || report.removed.length || report.modified.length) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
