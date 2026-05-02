#!/usr/bin/env node
import { createRequire } from 'node:module';
/**
 * migrate-photos.js
 * Migrates legacy RTDB base64 photo entries to Firebase Storage + lightweight RTDB metadata.
 *
 * Legacy format (RTDB):
 *   photos/{date}/{id} = "<base64 string>"
 *
 * New format:
 *   Storage: photos/{date}/{id}.jpg  (binary JPEG)
 *   RTDB:    photos/{date}/{id} = { url, path, ts }
 *
 * Usage:
 *   1. Download a Firebase Admin service account key from the Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as serviceAccountKey.json (never commit this file)
 *
 *   2. Install dependencies (one-time):
 *      npm install firebase-admin
 *
 *   3. Run:
 *      node scripts/migrate-photos.js --key=./serviceAccountKey.json [--dry-run]
 *
 *   Options:
 *     --key=<path>   Path to service account JSON key file (required)
 *     --dry-run      Print what would be migrated without writing anything
 *
 *   The script is safe to re-run: already-migrated entries (objects) are skipped.
 *   Failed entries are logged individually; the script continues with the rest.
 */

const require = createRequire(import.meta.url);

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const keyArg = args.find(a => a.startsWith('--key='));
const dryRun = args.includes('--dry-run');

if (!keyArg) {
  console.error('Usage: node scripts/migrate-photos.js --key=./serviceAccountKey.json [--dry-run]');
  process.exit(1);
}

const keyPath = path.resolve(keyArg.replace('--key=', ''));
if (!fs.existsSync(keyPath)) {
  console.error('Service account key not found:', keyPath);
  process.exit(1);
}

// ── Firebase Admin init ───────────────────────────────────────────────────────
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('firebase-admin not installed. Run: npm install firebase-admin');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
} catch (e) {
  console.error('Failed to parse service account key file. Make sure it is valid JSON:', keyPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://france-irlande-bike-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: 'france-irlande-bike.firebasestorage.app'
});

const db = admin.database();
const bucket = admin.storage().bucket();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a base64 data URL or raw base64 string to a Buffer.
 * @param {string} b64
 * @returns {Buffer}
 */
function base64ToBuffer(b64) {
  const comma = b64.indexOf(',');
  const raw = comma !== -1 ? b64.slice(comma + 1) : b64;
  return Buffer.from(raw, 'base64');
}

/**
 * Uploads a JPEG buffer to Firebase Storage and returns the public download URL.
 * @param {string} storagePath  e.g. "photos/2026-05-02/p_123.jpg"
 * @param {Buffer} buffer
 * @returns {Promise<string>} download URL
 */
async function uploadToStorage(storagePath, buffer) {
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType: 'image/jpeg' },
    resumable: false
  });
  // Make the file publicly readable (same access policy as Storage rules: read = true)
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ── Main migration ────────────────────────────────────────────────────────────
async function migrate() {
  console.log(dryRun ? '[DRY RUN] ' : '' + 'Reading photos from RTDB…');

  const snapshot = await db.ref('photos').once('value');
  const photosTree = snapshot.val();

  if (!photosTree || typeof photosTree !== 'object') {
    console.log('No photos found in RTDB. Nothing to migrate.');
    return;
  }

  const dates = Object.keys(photosTree);
  let total = 0, migrated = 0, skipped = 0, failed = 0;

  for (const date of dates) {
    const dateEntries = photosTree[date];
    if (!dateEntries || typeof dateEntries !== 'object') continue;

    const ids = Object.keys(dateEntries);

    for (const id of ids) {
      total++;
      const value = dateEntries[id];

      // Already migrated: object format → skip
      if (value && typeof value === 'object') {
        console.log(`  [SKIP] ${date}/${id} — already migrated`);
        skipped++;
        continue;
      }

      // Not a string → unexpected, skip safely
      if (typeof value !== 'string') {
        console.warn(`  [SKIP] ${date}/${id} — unexpected type: ${typeof value}`);
        skipped++;
        continue;
      }

      const storagePath = `photos/${date}/${id}.jpg`;
      // base64 adds ~33% overhead, so decoded size ≈ length × 0.75
      console.log(`  [MIGRATE] ${date}/${id} → ${storagePath} (${Math.round(value.length * 0.75 / 1024)} KB decoded)`);

      if (dryRun) {
        migrated++;
        continue;
      }

      try {
        const buffer = base64ToBuffer(value);
        const url = await uploadToStorage(storagePath, buffer);
        const meta = { url, path: storagePath, ts: Date.now() };

        await db.ref(`photos/${date}/${id}`).set(meta);
        console.log(`    ✓ done — ${url}`);
        migrated++;
      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
        failed++;
      }
    }
  }

  console.log('');
  console.log('── Migration complete ──────────────────────────────────');
  console.log(`  Total entries examined : ${total}`);
  console.log(`  Migrated               : ${migrated}`);
  console.log(`  Skipped (already done) : ${skipped}`);
  console.log(`  Failed                 : ${failed}`);
  if (dryRun) console.log('  (DRY RUN — no data was written)');
  console.log('────────────────────────────────────────────────────────');

  if (failed > 0) process.exit(1);
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
