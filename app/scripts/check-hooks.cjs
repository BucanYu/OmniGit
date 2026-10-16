const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');
let hasError = false;
let checkedComponents = 0;

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      let name = '';
      if (node.name && ts.isIdentifier(node.name)) {
        name = node.name.text;
      } else if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
        name = node.parent.name.text;
      }

      if (name && /^[A-Z]/.test(name) && node.body && ts.isBlock(node.body)) {
        checkedComponents++;
        let seenEarlyReturn = false;
        let returnLine = 0;

        for (const stmt of node.body.statements) {
          if (stmt.kind === ts.SyntaxKind.ReturnStatement && stmt !== node.body.statements[node.body.statements.length - 1]) {
            seenEarlyReturn = true;
            returnLine = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
          } else if (ts.isIfStatement(stmt)) {
            const thenHasReturn = ts.isReturnStatement(stmt.thenStatement) ||
              (ts.isBlock(stmt.thenStatement) && stmt.thenStatement.statements.some(s => ts.isReturnStatement(s)));
            if (thenHasReturn) {
              seenEarlyReturn = true;
              returnLine = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
            }
          }

          if (seenEarlyReturn) {
            function checkHook(child) {
              if (ts.isCallExpression(child)) {
                let callName = '';
                if (ts.isIdentifier(child.expression)) {
                  callName = child.expression.text;
                } else if (ts.isPropertyAccessExpression(child.expression)) {
                  callName = child.expression.name.text;
                }
                if (/^use[A-Z]/.test(callName)) {
                  const line = sourceFile.getLineAndCharacterOfPosition(child.getStart()).line + 1;
                  console.error(`[HOOK ERROR] In <${name}> at ${path.relative(process.cwd(), filePath)}:${line}`);
                  console.error(`  ❌ Hook "${callName}" is called after early return at line ${returnLine}!`);
                  hasError = true;
                }
              }
              // Do not descend into nested callbacks/functions, since they have their own scope
              if (!ts.isFunctionDeclaration(child) && !ts.isArrowFunction(child) && !ts.isFunctionExpression(child)) {
                ts.forEachChild(child, checkHook);
              }
            }
            if (stmt.kind !== ts.SyntaxKind.ReturnStatement && !ts.isIfStatement(stmt)) {
              checkHook(stmt);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanDir(full);
    else if (entry.name.endsWith('.tsx')) checkFile(full);
  }
}

scanDir(srcDir);

if (hasError) {
  console.error('\n❌ React Hook rules violated! All hooks must be called unconditionally at the top of components.');
  process.exit(1);
} else {
  console.log(`✅ React Hook rules check passed (${checkedComponents} components checked, 0 violations).`);
}
