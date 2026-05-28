const fs = require('fs');
const text = fs.readFileSync('./test-flow.txt', 'utf8');

const uniqueNodes = new Map();
const parsedConnections = [];
const lines = text.split('\n');
let currentNode = null;
let currentProp = null;

for (let rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  if (line.toLowerCase().startsWith('flow:')) {
    currentProp = null;
  } else if (line.toLowerCase().startsWith('description:')) {
    currentProp = null;
  } else if (line.match(/^\[Node:(.+)\]/i)) {
    const match = line.match(/^\[Node:(.+)\]/i);
    const nodeName = match[1].trim();
    currentNode = nodeName;
    currentProp = null;
    if (!uniqueNodes.has(nodeName)) {
        uniqueNodes.set(nodeName, { name: nodeName });
    }
  } else if (currentNode && line.toLowerCase().startsWith('input:')) {
    currentProp = 'inputParams';
    uniqueNodes.get(currentNode).inputParams = line.substring(6).trim();
  } else if (currentNode && line.toLowerCase().startsWith('validation:')) {
    currentProp = 'validationRules';
    uniqueNodes.get(currentNode).validationRules = line.substring(11).trim();
  } else if (currentNode && line.toLowerCase().startsWith('logic:')) {
    currentProp = 'processLogic';
    uniqueNodes.get(currentNode).processLogic = line.substring(6).trim();
  } else if (currentNode && line.toLowerCase().startsWith('output:')) {
    currentProp = 'outputTemplate';
    uniqueNodes.get(currentNode).outputTemplate = line.substring(7).trim();
  } else if (line.toLowerCase().startsWith('connections:')) {
    currentNode = null;
    currentProp = null;
  } else if (line.includes('->')) {
    currentNode = null; 
    currentProp = null;
    let cleanedLine = line.replace(/Node_name:/gi, '').replace(/Connect/gi, '');
    const parts = cleanedLine.split('->').map(p => p.trim()).filter(Boolean);
    
    for (let i = 0; i < parts.length - 1; i++) {
      const source = parts[i];
      const target = parts[i+1];
      if (!uniqueNodes.has(source)) uniqueNodes.set(source, { name: source });
      if (!uniqueNodes.has(target)) uniqueNodes.set(target, { name: target });
      parsedConnections.push({ source, target });
    }
  } else if (currentNode && currentProp) {
    uniqueNodes.get(currentNode)[currentProp] += '\n' + rawLine;
  }
}

console.log(Array.from(uniqueNodes.entries()));
console.log(parsedConnections);
