import serverless from 'serverless-http';
import { app } from '../src/app.js';

// Vercel serverless function entry — wraps the Express app.
export const handler = serverless(app);
export default handler;