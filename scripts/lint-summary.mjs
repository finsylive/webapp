const { createReadStream } = require('fs');
const path = require('path');
const inputPath = path.join(require('os').tmpdir(), 'eslint-output.json');

let buffer = '';
const ruleCount = {};
let total = 0;

const stream = createReadStream(inputPath, { encoding: 'utf8', highWaterMark: 64 * 1024 });

stream.on('data', (chunk) => {
    buffer += chunk;
    // Extract "ruleId":"..." patterns
    const regex = /"ruleId":"([^"]+)"/g;
    let match;
    while ((match = regex.exec(buffer)) !== null) {
        const rule = match[1];
        ruleCount[rule] = (ruleCount[rule] || 0) + 1;
        total++;
    }
    // Keep only the last 200 chars to avoid missing split patterns
    buffer = buffer.slice(-200);
});

stream.on('end', () => {
    console.log('Total issues: ' + total);
    const sorted = Object.entries(ruleCount).sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of sorted) {
        console.log(String(count).padStart(6) + '  ' + rule);
    }
});

stream.on('error', (err) => {
    console.error('Error:', err.message);
});
