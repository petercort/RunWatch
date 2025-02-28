import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from 'dotenv';
import { createNodeMiddleware } from '@octokit/webhooks';
import connectDB from './src/config/db.js';
import apiRoutes from './src/routes/api.js';
import setupSocket from './src/middleware/socket.js';
import setupGithubWebhooks from './src/middleware/github.js';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Parse raw body for webhook endpoint
app.use('/api/webhooks/github', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  
  req.on('data', chunk => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    
    // Handle form-encoded data
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      try {
        // Store the raw form data for signature verification
        req.rawBody = data;
        // Parse the payload for processing
        const match = data.match(/^payload=(.+)$/);
        if (match) {
          const decodedPayload = decodeURIComponent(match[1]);
          req.body = JSON.parse(decodedPayload);
        }
      } catch (error) {
        console.error('Error parsing form-encoded payload:', error);
      }
    } else {
      // For JSON payloads, use the raw body for both verification and processing
      try {
        req.body = JSON.parse(data);
      } catch (error) {
        console.error('Error parsing JSON payload:', error);
      }
    }
    
    next();
  });
});

// Parse JSON for other routes
app.use(express.json());

// Make io available in request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize GitHub webhooks instance
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.error('GITHUB_WEBHOOK_SECRET is not configured!');
}
console.log('Setting up GitHub webhooks with secret:', webhookSecret ? 'Secret provided' : 'NO SECRET PROVIDED');
const webhooks = setupGithubWebhooks(webhookSecret);

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

// POST handler for actual webhook events
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
    const rawBody = req.rawBody;
    console.log('Raw body length:', rawBody?.length);
    console.log('Raw body preview:', rawBody?.substring(0, 100));

    // First verify the signature with the raw body
    const verified = await webhooks.verify({
      id,
      name,
      signature,
      payload: req.body,
      rawBody
    });

    if (!verified) {
      throw new Error('Webhook signature verification failed');
    }

    // Then process the webhook with the parsed payload
    await webhooks.receive({
      id,
      name,
      payload: req.body
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook verification or processing failed:', error);
    console.error('Raw body:', req.rawBody);
    res.status(400).json({ 
      error: 'Webhook verification failed',
      message: error.message
    });
  }
});

// General API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
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