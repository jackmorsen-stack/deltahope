import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * Vercel Blob persistence for the SQLite database.
 * Serverless functions have an ephemeral filesystem, so on Vercel we:
 *  - restore the DB into /tmp on cold start (before opening it)
 *  - upload it back to Blob after every data-modifying request
 * When not running on Vercel (or Blob token missing) these are no-ops.
 */

const isVercel = () => !!process.env.VERCEL;

function blobClient() {
  // Lazy require so this module also works when @vercel/blob is absent locally.
  try {
    return import('@vercel/blob');
  } catch {
    return null;
  }
}

const BLOB_KEY = 'applications.db';

/**
 * Download the persisted database from Vercel Blob into config.dbFile.
 * Must run before the Database instance is opened.
 */
export async function restoreDb() {
  if (!isVercel()) return false;
  try {
    const blob = await blobClient();
    if (!blob) return false;
    const { list } = blob;
    const res = await list({ prefix: BLOB_KEY, limit: 1 });
    const item = res.blobs && res.blobs[0];
    if (!item) return false;
    // @vercel/blob v2 has no `download` helper — fetch the blob URL directly.
    const dl = await fetch(item.downloadUrl || item.url);
    if (!dl.ok) throw new Error(`blob fetch ${dl.status}`);
    const buf = Buffer.from(await dl.arrayBuffer());
    fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
    fs.writeFileSync(config.dbFile, buf);
    console.log('[blob] restored database from Vercel Blob');
    return true;
  } catch (err) {
    console.error('[blob] restore failed:', err.message);
    return false;
  }
}

/**
 * Upload the current database file back to Vercel Blob.
 * Call after any mutating request.
 */
export async function backupDb() {
  if (!isVercel()) return false;
  try {
    if (!fs.existsSync(config.dbFile)) return false;
    const blob = await blobClient();
    if (!blob) return false;
    const { put } = blob;
    const data = fs.readFileSync(config.dbFile);
    await put(BLOB_KEY, data, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/octet-stream',
    });
    return true;
  } catch (err) {
    console.error('[blob] backup failed:', err.message);
    return false;
  }
}

export { isVercel };
