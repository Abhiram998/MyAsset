/**
 * Vercel Serverless Function Entry Point for MyAsset
 * Exports the Express application to be executed by Vercel's Serverless Node.js runtime.
 */
const app = require('../server/server');

module.exports = app;
