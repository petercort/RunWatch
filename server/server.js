import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from 'dotenv';
import { createNodeMiddleware as _createNodeMiddleware } from '@octokit/webhooks';
import connectDB from './src/config/db.js';
import apiRoutes from './src/routes/api.js';
import setupSocket from './src/middleware/socket.js';
import setupGithubWebhooks from './src/middleware/github.js';
import path from 'path';
import { fileURLToPath } from 'url';
import getRawBody from 'raw-body';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env
config({ path: path.join(__dirname, '../.env') });

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = setupSocket(server);
// Make io globally available
global.io = io;

// Basic middleware
app.use(cors());

// Initialize GitHub webhooks instance
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.error('GITHUB_WEBHOOK_SECRET is not configured!');
}
console.log('Setting up GitHub webhooks with secret:', webhookSecret ? 'Secret provided' : 'NO SECRET PROVIDED');
const webhooks = setupGithubWebhooks(webhookSecret);

// Raw body handler for GitHub webhooks
app.post('/api/webhooks/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const id = req.headers['x-github-delivery'];
  const name = req.headers['x-github-event'];
  const contentType = req.headers['content-type'];

  console.log('Received webhook POST request from GitHub');
  console.log('Event:', name);
  console.log('Delivery ID:', id);
  console.log('Content-Type:', contentType);
  console.log('Signature:', signature);

  if (!signature || !id || !name) {
    console.error('Missing required webhook headers');
    return res.status(400).json({ error: 'Missing required webhook headers' });
  }

  try {
    // Get the raw body as a buffer
    const rawBody = await getRawBody(req);
    console.log('Raw body length:', rawBody.length);

    // First verify the signature with the raw body
    const verified = await webhooks.verify({
      signature,
      rawBody
    });

    if (!verified) {
      throw new Error('Webhook signature verification failed');
    }

    // Parse the raw body as JSON for webhook processing
    const payload = JSON.parse(rawBody.toString());

    // Process the webhook with the parsed payload
    await webhooks.receive({
      id,
      name,
      payload
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook verification or processing failed:', error);
    res.status(400).json({ 
      error: 'Webhook verification failed',
      message: error.message
    });
  }
});

// GET handler for webhook endpoint verification
app.get('/api/webhooks/github', (req, res) => {
  console.log('Received GET request to webhook endpoint - likely a verification request');
  console.log('Headers:', req.headers);
  res.status(200).json({ 
    message: 'GitHub webhook endpoint is active', 
    timestamp: new Date().toISOString(),
    note: 'This endpoint accepts POST requests from GitHub webhooks'
  });
});

// Configure Express app with increased body size limit for non-webhook routes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Make io available in request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// General API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server - Use both PORT and SERVER_PORT to handle both conventions
const PORT = process.env.PORT || process.env.SERVER_PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhooks/github`);
  console.log('Webhook secret configured:', webhookSecret ? 'Yes' : 'No');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});