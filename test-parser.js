const fs = require('fs');

const text = fs.readFileSync('./test-flow.txt', 'utf8');

fetch('http://localhost:3001/api/flows/generate-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
})
  .then(res => res.json().then(data => ({ status: res.status, data })))
  .then(({ status, data }) => {
    if (status >= 400) console.log('ERROR:', data);
    else console.log('SUCCESS:', data);
  })
  .catch(err => console.log('ERROR:', err));
