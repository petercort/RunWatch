import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';

export const getGitHubClient = async (installationId = null) => {
    const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const appId = process.env.GITHUB_APP_ID;

    if (!privateKeyPath || !appId) {
        throw new Error('Missing required GitHub App configuration');
    }

    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

        // Base authentication configuration
        const auth = {
            appId: appId,
            privateKey: privateKey,
            request: {
                retries: 3,
                timeout: 5000
            }
        };

        // Add installation ID if provided
        if (installationId) {
            auth.installationId = installationId;
        }

        const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth,
            baseUrl: 'https://api.github.com',
            log: {
                //debug: console.debug,
                //info: console.info,
                warn: console.warn,
                error: console.error
            }
        });

        // If no installation ID provided, return the app client and list of installations
        if (!installationId) {
            const { data: installations } = await octokit.rest.apps.listInstallations();
            return {
                app: octokit,
                installations: installations.map(install => ({
                    id: install.id,
                    account: {
                        login: install.account.login,
                        type: install.account.type
                    }
                }))
            };
        }
        return { app: octokit };
    } catch (error) {
        console.error('Error in getGitHubClient:', error);
        throw error;
    }
};

export const validateGitHubConfig = () => {
    const requiredVars = [
        'GITHUB_APP_ID',
        'GITHUB_APP_PRIVATE_KEY_PATH'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required GitHub configuration: ${missing.join(', ')}`);
    }

    // Verify private key file exists
    const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`GitHub App private key file not found at: ${privateKeyPath}`);
    }
};