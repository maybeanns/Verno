const fs = require('fs');
const filePath = 'd:\\Verno\\src\\extension.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Find the PRD resumption block and replace it
const searchStart = "Do you want to resume the SDLC workflow or start a new debate?";
const searchEnd = "SDLCWebviewPanel.createOrShow(context, logger, llmService, undefined, existingPrd);\r\n\t\t\t\t\t\t\treturn;\r\n\t\t\t\t\t\t}\r\n\t\t\t\t\t}";

const startIdx = content.indexOf(searchStart);
if (startIdx === -1) {
  console.log('ERROR: Start marker not found');
  process.exit(1);
}

// Find the beginning of the if block (go back to find the if line)
const ifStart = content.lastIndexOf('if (existingPrd && existingPrd.title', startIdx);
if (ifStart === -1) {
  console.log('ERROR: if-block start not found');
  process.exit(1);
}

const endIdx = content.indexOf(searchEnd, startIdx);
if (endIdx === -1) {
  console.log('ERROR: End marker not found');
  process.exit(1);
}

const blockEnd = endIdx + searchEnd.length;
const oldBlock = content.substring(ifStart, blockEnd);
console.log('Found block length:', oldBlock.length);

const newBlock = `if (existingPrd && existingPrd.title && Array.isArray(existingPrd.sections) && existingPrd.sections.length > 0) {\r
\t\t\t\t\t\tconst resumeChoice = await vscode.window.showInformationMessage(\r
\t\t\t\t\t\t\t\`Existing PRD found: "\${existingPrd.title}". How would you like to proceed?\`,\r
\t\t\t\t\t\t\t'Skip to Execution',\r
\t\t\t\t\t\t\t'Review PRD',\r
\t\t\t\t\t\t\t'Start New Debate'\r
\t\t\t\t\t\t);\r
\r
\t\t\t\t\t\tif (resumeChoice === 'Skip to Execution') {\r
\t\t\t\t\t\t\tagentPanel.showThinking(true);\r
\t\t\t\t\t\t\tagentPanel.addMessage('system', 'Skipping to execution for: **' + existingPrd.title + '**. PRD loaded (' + existingPrd.sections.length + ' sections). BMAD agents starting...');\r
\t\t\t\t\t\t\tconst orchestrator = agentRegistry.get('orchestrator');\r
\t\t\t\t\t\t\tif (orchestrator) {\r
\t\t\t\t\t\t\t\ttry {\r
\t\t\t\t\t\t\t\t\tawait orchestrator.onPRDApproved(existingPrd, context, agentPanel);\r
\t\t\t\t\t\t\t\t} catch (execErr) {\r
\t\t\t\t\t\t\t\t\tagentPanel.showThinking(false);\r
\t\t\t\t\t\t\t\t\tagentPanel.addMessage('system', 'Execution failed: ' + (execErr.message || execErr));\r
\t\t\t\t\t\t\t\t\tvscode.window.showErrorMessage('BMAD Pipeline failed: ' + (execErr.message || execErr));\r
\t\t\t\t\t\t\t\t}\r
\t\t\t\t\t\t\t}\r
\t\t\t\t\t\t\treturn;\r
\t\t\t\t\t\t}\r
\r
\t\t\t\t\t\tif (resumeChoice === 'Review PRD') {\r
\t\t\t\t\t\t\tagentPanel.showThinking(false);\r
\t\t\t\t\t\t\tagentPanel.addMessage('system', 'Opening PRD for review: **' + existingPrd.title + '**');\r
\t\t\t\t\t\t\tconst { SDLCWebviewPanel } = require('./panels/SDLCWebviewPanel');\r
\t\t\t\t\t\t\tSDLCWebviewPanel.createOrShow(context, logger, llmService, undefined, existingPrd);\r
\t\t\t\t\t\t\treturn;\r
\t\t\t\t\t\t}\r
\t\t\t\t\t\t// 'Start New Debate' or dismissed - falls through to debate flow\r
\t\t\t\t\t}`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('SUCCESS: PRD dialog replaced with 3-option version');
