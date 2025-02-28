const crypto = require('crypto');

// Generate a random 32-byte hex string
const webhookSecret = crypto.randomBytes(32).toString('hex');

console.log('\nGenerated GitHub Webhook Secret:');
console.log('--------------------------------');
console.log(webhookSecret);
console.log('--------------------------------');
console.log('\nAdd this to your .env file as:');
console.log(`GITHUB_WEBHOOK_SECRET=${webhookSecret}\n`);