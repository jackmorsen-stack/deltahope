import { app } from '../src/app.js';

// Vercel serverless function entry.
// Vercel's Node.js runtime invokes the function with the standard (req, res)
// signature, and an Express `app` instance is itself a valid (req, res) handler,
// so we export it directly. (Do NOT wrap with serverless-http — that produces an
// AWS Lambda-style (event, context) handler which is incompatible with Vercel
// and causes every request to fail with "Internal server error.")
export default app;
