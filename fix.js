const fs = require('fs');
let content = fs.readFileSync('src/agents/specialized/CodeHealerLoop.ts', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\\n/g, '\\n');
fs.writeFileSync('src/agents/specialized/CodeHealerLoop.ts', content);
console.log('Fixed CodeHealerLoop');
