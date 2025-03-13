import { Webhooks } from '@octokit/webhooks';
import * as workflowService from '../services/workflowService.js';
import crypto from 'crypto';

const setupGithubWebhooks = (secret) => {
  if (!secret) {
    console.error('GitHub webhook secret is not configured!');
    throw new Error('GITHUB_WEBHOOK_SECRET must be configured');
  }
  
  console.log('Setting up GitHub webhooks with secret:', 'Secret provided');
  
  const webhooks = new Webhooks({
    secret: secret,
    transform: (event) => {
      if (event.name === 'ping') {
        return { ...event, ping: true };
      }
      return event;
    },
  });

  // Override verify method to work with both raw form data and JSON
  webhooks.verify = async (options) => {
    const { signature, rawBody } = options;
    
    if (!signature) {
      throw new Error('Signature is required');
    }

    if (!rawBody || typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
      throw new Error('Raw body must be a string or Buffer');
    }

    const sig = Buffer.from(signature);
    const hmac = crypto.createHmac('sha256', secret);
    const data = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    hmac.update(data);
    const hash = Buffer.from(`sha256=${hmac.digest('hex')}`, 'utf8');

    if (sig.length !== hash.length || !crypto.timingSafeEqual(sig, hash)) {
      throw new Error('Signature does not match');
    }

    return true;
  };

  // GitHub ping event
  webhooks.on('ping', ({ payload }) => {
    console.log('Received ping event from GitHub:', payload.zen);
    return { ok: true };
  });

  // GitHub workflow_job events
  webhooks.on('workflow_job', async ({ payload }) => {
    console.log(`Workflow job event received: ${payload.workflow_job?.name} - ${payload.action}`);
    try {
      const workflowRun = await workflowService.processWorkflowJobEvent(payload);
      // The Socket.IO instance will be passed in the request object
      if (global.io) {
        global.io.emit('workflowJobsUpdate', workflowRun);
      }
      return { ok: true };
    } catch (error) {
      console.error('Error processing workflow job event:', error);
      throw error;
    }
  });

  // GitHub workflow_run events
  webhooks.on('workflow_run', async ({ payload }) => {
    console.log(`Workflow run event received: ${payload.workflow_run?.name} - ${payload.action}`);
    try {
      const workflowRun = await workflowService.processWorkflowRun(payload);
      // The Socket.IO instance will be passed in the request object
      if (global.io) {
        global.io.emit('workflowUpdate', workflowRun);
      }
      return { ok: true };
    } catch (error) {
      console.error('Error processing workflow run event:', error);
      throw error;
    }
  });

  // Add error handling for webhooks
  webhooks.onError((error) => {
    console.error('Error processing webhook:', error);
    if (error.name === 'WebhookSecretError') {
      console.error('Webhook secret verification failed. Check your GITHUB_WEBHOOK_SECRET configuration.');
      if (error.event) {
        console.debug('Event details:', {
          name: error.event.name,
          id: error.event.id,
          signature: error.event.signature,
          rawBodyLength: error.event.rawBody?.length
        });
      }
    }
    throw error;
  });

  return webhooks;
};

export default setupGithubWebhooks;