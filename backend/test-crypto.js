// test-crypto.js — verifikasi cryptoService
process.env.CODE_ENCRYPT_KEY = 'b5a9f4169bd0273c3f9026c6e449d73a409c9383e60742cd1e1c8764e2c209fe';
process.env.RSA_PRIVATE_KEY  = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRRGFwWExqTXF4U3FtYUsKWU1KcXZLalpDSkNkQkc0Yi9JNGZ6THlSaytPdkhiTnBsL3A3R0s0YXAyQU82TlZoRGRUMUdBdWQxMmhhSXNzNQpZSE84OTlwN25mZ3E1UWd2clAzOFhKd1FlZEd4cCtBMGtCamRHdlNNd012MlIxd05hcUhCR09WZEtudFZ0bUNjCjdnVVU1TzVuRktTL2NSTiticEwyMDVRRXYwazIxQXpreXBCSDMyT3BxQThlR2UrZ3FlZ2hBVHlrNk1FQ3lDWFEKWHdJdWpxdW0wandFUnhXbTNQL1J4MWlyWXpFd0pybGEvNVBkaCtvTDA4cE02V2JtYStwbTJUQkl0SUE5NS9aeAp2aU1uUHlLK044ZGU1YjF0aVpVM1FuaUtyU2ptTkRHUDVpTkRPNmxVWG91NUlUSXQyazV2R3NDUm1iTEV6TXZxCk15bEgreXZCQWdNQkFBRUNnZ0VBQWJpend0NHZSU2RhVDFTYnMwTnhBT1IwWHdnZDVkS0RPL1RjdHppMjNqWVoKcDRjdXpiRlFEWjJydi9KTlc4cEVGdm50Zlh5b3NhejhkS014eGhjZGZVT3RKSWxSR3k3OWdQTXB0MmQrSXl2egpNL2ErZTE4dTlieSszbDJKZUFHUzdIWkp1QVlSbW9jcEU1TThMd0h1YnBsWEFycmRNRzJtY3BNUDQwbXVSZVE1CnpBSG9mSWFRUTR6NGxwUWE5dXpTc2JIR2tKNHRWWWxmZmpFNXNyUUJzRXJBeXlRMytKQXJlQmIwUUtRbmhvQ3QKeTB3bFpXSzdBaHVNUXRwd3oxaTF5RlV0d2p1Rkc4bkxJTnlQbXpaWXVHK3VKUjNzSTExRVpBWFd5eWN4Mkw0QQpnY1kvUWxEWWRESXlOYUo2akJ5N2ZXRjUvWEdLTVlEcnpUc1dwb0ZzQVFLQmdRRHQzekl1ZEhsdkdVeTdzY3B6CjY1YWpyRzBoOStkV2U5OVNRWG45YUZkRldmSnJxb1lsSHg2UGdaWmRacWM1YW9ZVHlOSDVGU1lsYkMzc2lLclQKaklSNW9rM2kzTlpPTWdFeWhsTWlacGlZZWxYanVPOEZId3ZwOHJRcjBXUWNrWFM3OHZZU0lYY2VlNm5taUd4UQpaV3BkZFFVN3ZjekwzOXd0dTRPcGN2NlFrUUtCZ1FEclR5cjlaTHpocDQ3YWw2QVUvcHRrOFY1azVqQVRXZWhRCnpBNi9XalU0Z2p5TDhCSytoNnlQNzd1NSt4c2tHT0FBM3B4a2NRQlZFM2NNTkFVeE9XWGpXZVdOTjZMOHp1MUIKbkRFNGJsRTllVVBWWElFREZENUpZek9ab0h3bUtTb0FvNEpvSzZOcWsrc0VoNjdXa3phV29FMWxuSGUvcmRBMwo1OHRYV2VtQU1RS0JnUUNKSTkweW0wUkhvVFowSUJTd3NHcXhBb0FJelh3NmlFQkFsQzlZd2dkT25JVC9QZGtKCkhkL29yTFdjTThyRmQzekZlMHBUYUxZTmJVa3N6YjV2S054WHBCTnpjQTYrRm1aS1V0Y3JSaXREL1lQM1BtL1AKYkE3YVdtczF1QXNYeldTWDE0TzNBRVJFOXRjRmFqSElTREFDb2F6YXZKcU9FQXBJODRyODdxZUZnUUtCZ0haQQpuK01keUFwQzhYaUs4R2o4bHMxQXUyWkxnK2VGckVsR2N6Yll0NXhCWHZvWVdPTWxQYVJNSHZSVTdBdlU4R1dmCmVjckVPeDJHSGJLbFJlSzU3S2szbVRQQnZRZjlXYUE2UlVZTnNvZ0pNL3k2Y3g5QUFobFJZRElaUTZyTnp3enAKSHZVSTBTUVRWKzA3M3JKNDR0c0pqanU5U1RTcnZkTUtpdGJJR1o5UkFvR0FGTm5hRnFBZXQwR2JKdG9uYm42agpGWnpYYzlTTDJPd3c1c3NJTEU1OWwzYmtiNVRST1ZFR1NXWUxoMTk5aGVmTVp2NDU4MXFQWXJrMHJpNTNRT3NiCnJQNU9HYys0cGtvRkpoV0ZleFR0SUlsM3VnLys0cmQzbkFsQTdtNm1YRXNPQ09JdGY2WCtyRkhhK2ovQzMxZXcKdmZPUVVaNlVpbmpOM1c0OHNJLzBaRDA9Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K';

const crypto = require('crypto');
const svc    = require('./src/services/cryptoService');

let pass = 0, fail = 0;
function check(name, result) {
  if (result) { console.log('  ✅', name); pass++; }
  else        { console.log('  ❌', name); fail++; }
}

console.log('\n=== Test cryptoService ===\n');

// Test 1: DB Encrypt & Decrypt
const plain = 'function secret() { return db.query(users); }';
const enc1 = svc.encryptForDb(plain);
check('DB encryptForDb produces encrypted string', svc.isDbEncrypted(enc1));
check('DB decryptFromDb recovers plaintext', svc.decryptFromDb(enc1) === plain);

// Test 2: isDbEncrypted rejects plaintext
check('isDbEncrypted rejects plaintext', !svc.isDbEncrypted('SELECT * FROM users'));

// Test 3: RSA Public Key
const pubPem = svc.getPublicKeyPem();
check('RSA Public Key starts with PEM header', pubPem.startsWith('-----BEGIN PUBLIC KEY-----'));

// Test 4: AES-GCM transport decrypt (simulate browser encrypt)
const aesKey = crypto.randomBytes(32);
const iv     = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
const encBuf = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
const tag    = cipher.getAuthTag();
const full   = Buffer.concat([encBuf, tag]);

const decrypted = svc.decryptTransport(
  full.toString('base64'),
  iv.toString('base64'),
  aesKey.toString('base64')
);
check('AES-GCM decryptTransport recovers plaintext', decrypted === plain);

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail > 0 ? 1 : 0);
