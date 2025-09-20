const fs = require('fs');
const parser = require('@babel/parser');
const diff = require('diff');

// Hash function for content comparison
function hashCode(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

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
  const functionBodies = new Map();
  const variableValues = new Map();
  const callChains = new Map();
  const conditionalBlocks = [];
  const loopStructures = [];
  const eventListeners = [];
  const objectProperties = new Map();

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

        // Extract complete function body for detailed comparison
        let functionBody = '';
        if (sourceCode && node.start !== undefined && node.end !== undefined) {
          functionBody = sourceCode.slice(node.start, node.end);
          functionBodies.set(funcName, functionBody);
        }

        entities.push({
          kind: 'function',
          name: funcName,
          details: {
            async: node.async,
            generator: node.generator,
            params: node.params?.length || 0,
            sourceSnippet: sourceSnippet,
            bodyHash: hashCode(functionBody),
            paramNames: node.params?.map(p => p.name || p.type) || []
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

          // Store variable value for detailed comparison
          let actualValue = null;
          if (decl.init) {
            if (decl.init.type === 'Literal') {
              actualValue = decl.init.value;
            } else if (decl.init.type === 'StringLiteral') {
              actualValue = decl.init.value;
            } else if (decl.init.type === 'NumericLiteral') {
              actualValue = decl.init.value;
            } else if (decl.init.type === 'BooleanLiteral') {
              actualValue = decl.init.value;
            }
            variableValues.set(varName, actualValue);
          }

          entities.push({
            kind: 'variable',
            name: varName,
            details: {
              declarationType: node.kind, // let, const, var
              hasInitializer: !!decl.init,
              initType: decl.init?.type || null,
              sourceSnippet: sourceSnippet,
              actualValue: actualValue,
              valueHash: hashCode(String(actualValue))
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
          const args = node.expression.arguments || [];
          
          // Enhanced call analysis
          let callName = 'unknown';
          let callContext = '';
          let isChained = false;
          
          if (callee?.type === 'Identifier') {
            callName = callee.name;
          } else if (callee?.type === 'MemberExpression') {
            const objName = callee.object?.name || 'obj';
            const propName = callee.property?.name || 'prop';
            callName = `${objName}.${propName}`;
            callContext = objName;
            
            // Detect method chaining
            if (callee.object?.type === 'CallExpression') {
              isChained = true;
              callName = 'chained-call';
            }
          } else if (callee?.type === 'CallExpression') {
            callName = 'chained-call';
            isChained = true;
          } else if (callee?.type === 'FunctionExpression' || callee?.type === 'ArrowFunctionExpression') {
            callName = 'anonymous-function';
          }

          // Store call chain information
          if (callContext) {
            if (!callChains.has(callContext)) {
              callChains.set(callContext, []);
            }
            callChains.get(callContext).push(callName);
          }

          // Detect specific patterns
          if (callee?.property?.name === 'addEventListener') {
            const eventType = args[0]?.value || args[0]?.raw || 'unknown';
            eventListeners.push({
              target: callee.object?.name || 'unknown',
              event: eventType,
              hasCallback: args.length > 1
            });
            
            entities.push({
              kind: 'event-listener',
              name: `<event:${callContext}.${eventType}>`,
              details: {
                target: callContext,
                eventType: eventType,
                hasCallback: args.length > 1,
                argumentCount: args.length
              },
              sig: JSON.stringify({
                type: 'addEventListener',
                target: callContext,
                event: eventType,
                argCount: args.length
              })
            });
          } else if (callee?.property?.name === 'addoption') {
            const optionName = args[0]?.value || args[0]?.raw || 'unknown';
            const optionType = args[1]?.name || 'unknown';
            const defaultValue = args[2]?.value !== undefined ? args[2].value : args[2]?.raw || 'unknown';
            
            entities.push({
              kind: 'addoption',
              name: `addoption:${optionName}`,
              details: {
                optionName: optionName,
                optionType: optionType,
                defaultValue: defaultValue,
                sourceSnippet: sourceCode && node.start !== undefined && node.end !== undefined 
                  ? sourceCode.slice(node.start, node.end).trim() 
                  : ''
              },
              sig: JSON.stringify({
                type: 'addoption',
                name: optionName,
                optionType: optionType,
                defaultValue: defaultValue
              })
            });
          } else if (callee?.object?.name === 'console') {
            const method = callee.property?.name || 'log';
            let logContent = '';
            if (sourceCode && node.start !== undefined && node.end !== undefined) {
              logContent = sourceCode.slice(node.start, node.end).trim();
              if (logContent.length > 150) {
                logContent = logContent.substring(0, 150) + '...';
              }
            }

            entities.push({
              kind: 'console-call',
              name: `<console.${method}>`,
              details: {
                method: method,
                argumentCount: args.length,
                firstArg: args[0]?.type || null,
                logContent: logContent,
                hasStringArg: args.some(arg => arg.type === 'StringLiteral' || arg.type === 'Literal')
              },
              sig: JSON.stringify({
                type: 'console',
                method: method,
                argCount: args.length,
                firstArgType: args[0]?.type
              })
            });
          } else {
            // Enhanced function call analysis
            let sourceSnippet = '';
            if (sourceCode && node.start !== undefined && node.end !== undefined) {
              sourceSnippet = sourceCode.slice(node.start, node.end).trim();
              if (sourceSnippet.length > 100) {
                sourceSnippet = sourceSnippet.substring(0, 100) + '...';
              }
            }

            entities.push({
              kind: 'function-call',
              name: `<call:${callName}>`,
              details: {
                callName: callName,
                argumentCount: args.length,
                calleeType: callee?.type || 'unknown',
                isChained: isChained,
                context: callContext,
                sourceSnippet: sourceSnippet,
                hasLiteralArgs: args.some(arg => arg.type === 'StringLiteral' || arg.type === 'NumericLiteral' || arg.type === 'BooleanLiteral'),
                argTypes: args.map(arg => arg.type).slice(0, 3) // First 3 arg types
              },
              sig: JSON.stringify({
                type: 'call',
                name: callName,
                argCount: args.length,
                calleeType: callee?.type,
                argTypes: args.map(arg => arg.type)
              })
            });
          }
        } else if (node.expression?.type === 'AssignmentExpression') {
          const left = node.expression.left;
          const right = node.expression.right;
          let targetName = 'complex';
          
          if (left?.type === 'Identifier') {
            targetName = left.name;
          } else if (left?.type === 'MemberExpression') {
            const objName = left.object?.name || 'obj';
            const propName = left.property?.name || 'prop';
            targetName = `${objName}.${propName}`;
          }

          entities.push({
            kind: 'assignment',
            name: `<assignment:${targetName}>`,
            details: {
              operator: node.expression.operator,
              targetType: left?.type || 'unknown',
              valueType: right?.type || 'unknown',
              targetName: targetName
            },
            sig: JSON.stringify({
              type: 'assignment',
              operator: node.expression.operator,
              targetType: left?.type,
              valueType: right?.type
            })
          });
        }
        break;

      case 'IfStatement':
        entities.push({
          kind: 'conditional',
          name: `<if-statement>`,
          details: {
            hasElse: !!node.alternate,
            testType: node.test?.type || 'unknown',
            isElseIf: node.alternate?.type === 'IfStatement'
          },
          sig: JSON.stringify({
            type: 'IfStatement',
            hasElse: !!node.alternate,
            testType: node.test?.type
          })
        });
        
        conditionalBlocks.push({
          type: 'if',
          hasElse: !!node.alternate,
          testType: node.test?.type
        });
        break;

      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
        entities.push({
          kind: 'loop',
          name: `<${node.type.toLowerCase()}>`,
          details: {
            loopType: node.type,
            hasInit: !!(node.init || node.left),
            hasTest: !!node.test,
            hasUpdate: !!node.update
          },
          sig: JSON.stringify({
            type: node.type,
            hasInit: !!(node.init || node.left),
            hasTest: !!node.test,
            hasUpdate: !!node.update
          })
        });
        
        loopStructures.push({
          type: node.type,
          hasInit: !!(node.init || node.left),
          hasTest: !!node.test
        });
        break;

      case 'TryStatement':
        entities.push({
          kind: 'try-catch',
          name: `<try-catch>`,
          details: {
            hasCatch: !!node.handler,
            hasFinally: !!node.finalizer,
            catchParam: node.handler?.param?.name || null
          },
          sig: JSON.stringify({
            type: 'TryStatement',
            hasCatch: !!node.handler,
            hasFinally: !!node.finalizer
          })
        });
        break;

      case 'ObjectExpression':
        if (node.properties && node.properties.length > 0) {
          const propNames = node.properties
            .filter(prop => prop.key?.name || prop.key?.value)
            .map(prop => prop.key?.name || prop.key?.value)
            .slice(0, 5); // First 5 properties

          entities.push({
            kind: 'object-literal',
            name: `<object:${propNames.length}props>`,
            details: {
              propertyCount: node.properties.length,
              propertyNames: propNames,
              hasComputedProps: node.properties.some(prop => prop.computed),
              hasMethods: node.properties.some(prop => prop.method || prop.value?.type === 'FunctionExpression')
            },
            sig: JSON.stringify({
              type: 'ObjectExpression',
              propCount: node.properties.length,
              propNames: propNames
            })
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
      if (d.paramNames && d.paramNames.length > 0) {
        details.push(`(${d.paramNames.slice(0, 3).join(', ')})`);
      }
      break;

    case 'variable':
      details.push(d.declarationType);
      if (d.hasInitializer) details.push(`= ${d.initType}`);
      if (d.actualValue !== null && d.actualValue !== undefined) {
        const val = typeof d.actualValue === 'string' ? `"${d.actualValue}"` : String(d.actualValue);
        if (val.length < 20) details.push(`val: ${val}`);
      }
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

    case 'console-call':
      details.push(`${d.method}`);
      details.push(`${d.argumentCount} args`);
      if (d.firstArg) details.push(`first: ${d.firstArg}`);
      break;

    case 'function-call':
      details.push(`${d.argumentCount} args`);
      if (d.isChained) details.push('chained');
      if (d.context) details.push(`on: ${d.context}`);
      if (d.hasLiteralArgs) details.push('literals');
      break;

    case 'event-listener':
      details.push(`event: ${d.eventType}`);
      details.push(`target: ${d.target}`);
      if (d.hasCallback) details.push('callback');
      break;

    case 'addoption':
      details.push(`type: ${d.optionType}`);
      if (d.defaultValue !== 'unknown') {
        details.push(`default: ${d.defaultValue}`);
      }
      break;

    case 'assignment':
      details.push(d.operator);
      details.push(`${d.targetType} → ${d.valueType}`);
      break;

    case 'conditional':
      if (d.hasElse) details.push('has-else');
      if (d.isElseIf) details.push('else-if');
      details.push(`test: ${d.testType}`);
      break;

    case 'loop':
      details.push(d.loopType.replace('Statement', ''));
      if (d.hasInit) details.push('init');
      if (d.hasTest) details.push('test');
      if (d.hasUpdate) details.push('update');
      break;

    case 'try-catch':
      if (d.hasCatch) details.push('catch');
      if (d.hasFinally) details.push('finally');
      if (d.catchParam) details.push(`param: ${d.catchParam}`);
      break;

    case 'object-literal':
      details.push(`${d.propertyCount} props`);
      if (d.hasComputedProps) details.push('computed');
      if (d.hasMethods) details.push('methods');
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
    'console-call': '📝',
    'function-call': '📞',
    'event-listener': '👂',
    'addoption': '⚙️',
    'assignment': '📝',
    'conditional': '🔀',
    'loop': '🔄',
    'try-catch': '🛡️',
    'object-literal': '📋',
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
      } else if (entity?.kind === 'console-call') {
        console.log(`   📋 Type: Console ${entity.details.method} statement`);
        console.log(`   📝 Arguments: ${entity.details.argumentCount}`);
        if (entity.details.firstArg) {
          console.log(`   🎯 First argument type: ${entity.details.firstArg}`);
        }
        if (entity.details.hasStringArg) {
          console.log(`   📄 Contains string arguments`);
        }

        // Show log content in verbose mode
        if (r.verbose && entity.details.logContent) {
          console.log(`   📄 Content: ${entity.details.logContent}`);
        }
      } else if (entity?.kind === 'function-call') {
        console.log(`   📋 Type: Function call`);
        console.log(`   📞 Call name: ${entity.details.callName}`);
        console.log(`   📝 Arguments: ${entity.details.argumentCount}`);
        if (entity.details.isChained) {
          console.log(`   🔗 Chained call`);
        }
        if (entity.details.context) {
          console.log(`   🎯 Context: ${entity.details.context}`);
        }
        if (entity.details.argTypes && entity.details.argTypes.length > 0) {
          console.log(`   🏷️  Arg types: ${entity.details.argTypes.join(', ')}`);
        }

        // Show source snippet in verbose mode
        if (r.verbose && entity.details.sourceSnippet) {
          console.log(`   📄 Source: ${entity.details.sourceSnippet}`);
        }
      } else if (entity?.kind === 'event-listener') {
        console.log(`   📋 Type: Event listener`);
        console.log(`   🎯 Target: ${entity.details.target}`);
        console.log(`   📡 Event: ${entity.details.eventType}`);
        if (entity.details.hasCallback) {
          console.log(`   🔧 Has callback function`);
        }
      } else if (entity?.kind === 'addoption') {
        console.log(`   📋 Type: Module option`);
        console.log(`   🏷️  Option name: ${entity.details.optionName}`);
        console.log(`   🔧 Option type: ${entity.details.optionType}`);
        console.log(`   💡 Default value: ${entity.details.defaultValue}`);

        // Show source snippet in verbose mode
        if (r.verbose && entity.details.sourceSnippet) {
          console.log(`   📄 Source: ${entity.details.sourceSnippet}`);
        }
      } else if (entity?.kind === 'conditional') {
        console.log(`   📋 Type: Conditional statement`);
        console.log(`   🔀 Test type: ${entity.details.testType}`);
        if (entity.details.hasElse) {
          console.log(`   ✅ Has else branch`);
        }
        if (entity.details.isElseIf) {
          console.log(`   🔗 Is else-if chain`);
        }
      } else if (entity?.kind === 'loop') {
        console.log(`   📋 Type: ${entity.details.loopType}`);
        if (entity.details.hasInit) console.log(`   🚀 Has initialization`);
        if (entity.details.hasTest) console.log(`   🔍 Has test condition`);
        if (entity.details.hasUpdate) console.log(`   🔄 Has update expression`);
      } else if (entity?.kind === 'try-catch') {
        console.log(`   📋 Type: Error handling block`);
        if (entity.details.hasCatch) console.log(`   🛡️  Has catch block`);
        if (entity.details.hasFinally) console.log(`   🏁 Has finally block`);
        if (entity.details.catchParam) {
          console.log(`   🏷️  Catch parameter: ${entity.details.catchParam}`);
        }
      } else if (entity?.kind === 'object-literal') {
        console.log(`   📋 Type: Object literal`);
        console.log(`   📊 Properties: ${entity.details.propertyCount}`);
        if (entity.details.propertyNames && entity.details.propertyNames.length > 0) {
          console.log(`   🏷️  Property names: ${entity.details.propertyNames.join(', ')}`);
        }
        if (entity.details.hasComputedProps) console.log(`   🔧 Has computed properties`);
        if (entity.details.hasMethods) console.log(`   ⚙️ Has method properties`);
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

// Advanced behavioral analysis functions
function analyzeBehavioralPatterns(entities) {
  const patterns = {
    eventHandlers: [],
    dataFlow: [],
    controlFlow: [],
    apiCalls: [],
    stateManagement: [],
    errorHandling: [],
    domManipulation: [],
    functionCalls: [],
    modulePatterns: []
  };

  for (const entity of entities) {
    switch (entity.kind) {
      case 'event-listener':
        patterns.eventHandlers.push({
          target: entity.details.target,
          event: entity.details.eventType,
          hasCallback: entity.details.hasCallback
        });
        break;

      case 'function-call':
        // API calls
        if (entity.details.callName.includes('fetch') || 
            entity.details.callName.includes('ajax') ||
            entity.details.callName.includes('request')) {
          patterns.apiCalls.push({
            name: entity.details.callName,
            args: entity.details.argumentCount,
            context: entity.details.context
          });
        }
        
        // DOM manipulation
        if (entity.details.callName.includes('createElement') ||
            entity.details.callName.includes('appendChild') ||
            entity.details.callName.includes('removeChild') ||
            entity.details.callName.includes('querySelector') ||
            entity.details.callName.includes('getElementById')) {
          patterns.domManipulation.push({
            name: entity.details.callName,
            args: entity.details.argumentCount,
            context: entity.details.context
          });
        }
        
        // General function calls for pattern analysis
        patterns.functionCalls.push({
          name: entity.details.callName,
          args: entity.details.argumentCount,
          context: entity.details.context,
          isChained: entity.details.isChained
        });
        break;

      case 'addoption':
        patterns.modulePatterns.push({
          type: 'option',
          name: entity.details.optionName,
          optionType: entity.details.optionType,
          defaultValue: entity.details.defaultValue
        });
        break;

      case 'assignment':
        if (entity.details.targetName.includes('state') ||
            entity.details.targetName.includes('config') ||
            entity.details.targetName.includes('setting')) {
          patterns.stateManagement.push({
            target: entity.details.targetName,
            operator: entity.details.operator,
            valueType: entity.details.valueType
          });
        }
        break;

      case 'conditional':
        patterns.controlFlow.push({
          type: 'conditional',
          testType: entity.details.testType,
          hasElse: entity.details.hasElse
        });
        break;

      case 'loop':
        patterns.controlFlow.push({
          type: entity.details.loopType,
          hasInit: entity.details.hasInit,
          hasTest: entity.details.hasTest
        });
        break;

      case 'try-catch':
        patterns.errorHandling.push({
          hasCatch: entity.details.hasCatch,
          hasFinally: entity.details.hasFinally,
          catchParam: entity.details.catchParam
        });
        break;
    }
  }

  return patterns;
}

function compareBehavioralPatterns(origPatterns, newPatterns) {
  const changes = {
    eventHandlers: compareArrays(origPatterns.eventHandlers, newPatterns.eventHandlers),
    apiCalls: compareArrays(origPatterns.apiCalls, newPatterns.apiCalls),
    stateManagement: compareArrays(origPatterns.stateManagement, newPatterns.stateManagement),
    controlFlow: compareArrays(origPatterns.controlFlow, newPatterns.controlFlow),
    errorHandling: compareArrays(origPatterns.errorHandling, newPatterns.errorHandling),
    domManipulation: compareArrays(origPatterns.domManipulation, newPatterns.domManipulation),
    functionCalls: compareArrays(origPatterns.functionCalls, newPatterns.functionCalls),
    modulePatterns: compareArrays(origPatterns.modulePatterns, newPatterns.modulePatterns)
  };

  return changes;
}

function compareArrays(arr1, arr2) {
  return {
    added: arr2.filter(item => !arr1.some(orig => JSON.stringify(orig) === JSON.stringify(item))),
    removed: arr1.filter(item => !arr2.some(newItem => JSON.stringify(newItem) === JSON.stringify(item))),
    unchanged: arr1.filter(item => arr2.some(newItem => JSON.stringify(newItem) === JSON.stringify(item)))
  };
}

function printBehavioralAnalysis(origPatterns, newPatterns, changes) {
  console.log('\n🧠 Behavioral Analysis:');
  console.log('─'.repeat(50));

  // Event Handlers
  if (changes.eventHandlers.added.length || changes.eventHandlers.removed.length) {
    console.log('👂 Event Handlers:');
    if (changes.eventHandlers.added.length) {
      console.log(`   ➕ Added: ${changes.eventHandlers.added.length} new event listeners`);
      changes.eventHandlers.added.forEach(handler => {
        console.log(`      📡 ${handler.target}.${handler.event}`);
      });
    }
    if (changes.eventHandlers.removed.length) {
      console.log(`   ➖ Removed: ${changes.eventHandlers.removed.length} event listeners`);
      changes.eventHandlers.removed.forEach(handler => {
        console.log(`      📡 ${handler.target}.${handler.event}`);
      });
    }
  }

  // API Calls
  if (changes.apiCalls.added.length || changes.apiCalls.removed.length) {
    console.log('🌐 API Calls:');
    if (changes.apiCalls.added.length) {
      console.log(`   ➕ Added: ${changes.apiCalls.added.length} new API calls`);
      changes.apiCalls.added.forEach(call => {
        console.log(`      📞 ${call.name} (${call.args} args)`);
      });
    }
    if (changes.apiCalls.removed.length) {
      console.log(`   ➖ Removed: ${changes.apiCalls.removed.length} API calls`);
      changes.apiCalls.removed.forEach(call => {
        console.log(`      📞 ${call.name} (${call.args} args)`);
      });
    }
  }

  // State Management
  if (changes.stateManagement.added.length || changes.stateManagement.removed.length) {
    console.log('🗃️  State Management:');
    if (changes.stateManagement.added.length) {
      console.log(`   ➕ Added: ${changes.stateManagement.added.length} state operations`);
      changes.stateManagement.added.forEach(state => {
        console.log(`      📝 ${state.target} ${state.operator} ${state.valueType}`);
      });
    }
    if (changes.stateManagement.removed.length) {
      console.log(`   ➖ Removed: ${changes.stateManagement.removed.length} state operations`);
      changes.stateManagement.removed.forEach(state => {
        console.log(`      📝 ${state.target} ${state.operator} ${state.valueType}`);
      });
    }
  }

  // Control Flow
  if (changes.controlFlow.added.length || changes.controlFlow.removed.length) {
    console.log('🔀 Control Flow:');
    if (changes.controlFlow.added.length) {
      console.log(`   ➕ Added: ${changes.controlFlow.added.length} control structures`);
      changes.controlFlow.added.forEach(flow => {
        console.log(`      🔄 ${flow.type}`);
      });
    }
    if (changes.controlFlow.removed.length) {
      console.log(`   ➖ Removed: ${changes.controlFlow.removed.length} control structures`);
      changes.controlFlow.removed.forEach(flow => {
        console.log(`      🔄 ${flow.type}`);
      });
    }
  }

  // DOM Manipulation
  if (changes.domManipulation.added.length || changes.domManipulation.removed.length) {
    console.log('🏗️  DOM Manipulation:');
    if (changes.domManipulation.added.length) {
      console.log(`   ➕ Added: ${changes.domManipulation.added.length} DOM operations`);
      changes.domManipulation.added.forEach(dom => {
        console.log(`      🔧 ${dom.name} (${dom.args} args)`);
      });
    }
    if (changes.domManipulation.removed.length) {
      console.log(`   ➖ Removed: ${changes.domManipulation.removed.length} DOM operations`);
      changes.domManipulation.removed.forEach(dom => {
        console.log(`      🔧 ${dom.name} (${dom.args} args)`);
      });
    }
  }

  // Module Patterns
  if (changes.modulePatterns.added.length || changes.modulePatterns.removed.length) {
    console.log('⚙️ Module Patterns:');
    if (changes.modulePatterns.added.length) {
      console.log(`   ➕ Added: ${changes.modulePatterns.added.length} module configurations`);
      changes.modulePatterns.added.forEach(mod => {
        console.log(`      🔧 ${mod.name} (${mod.optionType}: ${mod.defaultValue})`);
      });
    }
    if (changes.modulePatterns.removed.length) {
      console.log(`   ➖ Removed: ${changes.modulePatterns.removed.length} module configurations`);
      changes.modulePatterns.removed.forEach(mod => {
        console.log(`      🔧 ${mod.name} (${mod.optionType}: ${mod.defaultValue})`);
      });
    }
  }

  // Error Handling
  if (changes.errorHandling.added.length || changes.errorHandling.removed.length) {
    console.log('🛡️  Error Handling:');
    if (changes.errorHandling.added.length) {
      console.log(`   ➕ Added: ${changes.errorHandling.added.length} error handling blocks`);
    }
    if (changes.errorHandling.removed.length) {
      console.log(`   ➖ Removed: ${changes.errorHandling.removed.length} error handling blocks`);
    }
  }

  // Function Call Analysis
  const origCallCount = origPatterns.functionCalls.length;
  const newCallCount = newPatterns.functionCalls.length;
  if (origCallCount !== newCallCount) {
    console.log('📞 Function Call Analysis:');
    console.log(`   📊 Total calls: ${origCallCount} → ${newCallCount} (${newCallCount > origCallCount ? '+' : ''}${newCallCount - origCallCount})`);
    
    // Analyze call patterns
    const origCallNames = origPatterns.functionCalls.map(call => call.name);
    const newCallNames = newPatterns.functionCalls.map(call => call.name);
    const uniqueOrigCalls = [...new Set(origCallNames)];
    const uniqueNewCalls = [...new Set(newCallNames)];
    
    if (uniqueOrigCalls.length !== uniqueNewCalls.length) {
      console.log(`   🔧 Unique functions: ${uniqueOrigCalls.length} → ${uniqueNewCalls.length}`);
    }
  }

  // Summary
  const totalBehavioralChanges = Object.values(changes).reduce((sum, change) => 
    sum + change.added.length + change.removed.length, 0);
  
  if (totalBehavioralChanges === 0) {
    console.log('✅ No significant behavioral changes detected');
  } else {
    console.log(`📊 Total behavioral changes: ${totalBehavioralChanges}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node diff.js <original.js> <new.js>');
    console.error('Options:');
    console.error('  --verbose, -v      Show detailed source code snippets');
    console.error('  --stats, -s        Show detailed file statistics');
    console.error('  --behavioral, -b   Show behavioral pattern analysis');
    console.error('  --all, -a          Show all analysis types');
    process.exit(1);
  }

  const flags = args.filter(arg => arg.startsWith('-'));
  const files = args.filter(arg => !arg.startsWith('-'));

  if (files.length < 2) {
    console.error('Error: Please provide two files to compare');
    process.exit(1);
  }

  const [oPath, nPath] = files;
  const verbose = flags.includes('--verbose') || flags.includes('-v') || flags.includes('--all') || flags.includes('-a');
  const showStats = flags.includes('--stats') || flags.includes('-s') || flags.includes('--all') || flags.includes('-a');
  const showBehavioral = flags.includes('--behavioral') || flags.includes('-b') || flags.includes('--all') || flags.includes('-a');

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

    // Behavioral analysis
    if (showBehavioral) {
      const origPatterns = analyzeBehavioralPatterns(entitiesA);
      const newPatterns = analyzeBehavioralPatterns(entitiesB);
      const behavioralChanges = compareBehavioralPatterns(origPatterns, newPatterns);
      printBehavioralAnalysis(origPatterns, newPatterns, behavioralChanges);
    }

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
