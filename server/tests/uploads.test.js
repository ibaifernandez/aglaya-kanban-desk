/**
 * Uploads security tests.
 * Regression for B-CRIT-01 (Marianas audit 2026-05-27, CVSS 8.0):
 *   /uploads/* serves files publicly via express.static + Netlify proxy.
 *   Before fix, multer accepted any MIME → SVG/HTML with <script> XSS.
 *   Fix: 3-layer defense (extension blocklist + MIME allowlist + magic bytes).
 */
const fs      = require('fs');
const path    = require('path');
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
  createAdminClient: jest.fn(),
  createPublicClient: jest.fn(),
}));

const app = require('../app');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'test@aglaya.is', role: 'admin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

// Minimal valid PNG header + IEND chunk (8-byte sig + IHDR + IEND)
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length+type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, // bit depth/color/etc + CRC
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND length+type
  0xae, 0x42, 0x60, 0x82,                         // IEND CRC
]);

describe('POST /api/uploads — security', () => {
  const token = makeToken();

  // Cleanup any leftover files from previous runs
  afterAll(() => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f === '.gitkeep') continue;
      try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
    }
  });

  it('rejects SVG uploads with 400 FILE_TYPE_FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^FILE_TYPE_FORBIDDEN/);
  });

  it('rejects HTML uploads with 400 FILE_TYPE_FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'evil.html',
        contentType: 'text/html',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^FILE_TYPE_FORBIDDEN/);
  });

  it('rejects JS content renamed to .png with 400 FILE_MAGIC_MISMATCH', async () => {
    // Sends JavaScript content but claims it's PNG. fileFilter passes (mime+ext OK),
    // but magic-bytes check (layer 4) detects mismatch and rejects.
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('alert(1); /* JS payload pretending to be PNG */'), {
        filename: 'spoofed.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('FILE_MAGIC_MISMATCH');
  });

  it('accepts a legitimate PNG with 200 and returns data.url', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_SIGNATURE, {
        filename: 'real.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect(res.body.data.type).toBe('image/png');
  });

  it('rejects upload without auth with 401', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', PNG_SIGNATURE, {
        filename: 'real.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
  });
});
