import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Helper function to verify the wallet-signed JWT token sent by the client.
 */
function verifyPramanToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signature] = parts;
    
    // Decode base64 URL-safe string
    const payloadString = Buffer.from(
      payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString();
    const payload = JSON.parse(payloadString);

    // 1. Expiration validation
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }

    // 2. Issuer validation
    if (payload.iss !== 'pramanauth') {
      throw new Error('Invalid token issuer');
    }

    // 3. Reconstruct payload signature string
    const messageToVerify = `${headerB64}.${payloadB64}`;

    // 4. Recover address of signing wallet
    const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);

    if (recoveredAddress.toLowerCase() !== payload.sub.toLowerCase()) {
      throw new Error('Invalid signature - wallet address mismatch');
    }

    return {
      valid: true,
      address: recoveredAddress,
      payload,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * POST /verify endpoint
 * Expects: { token: string }
 */
app.post('/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token is required' });
  }

  const result = verifyPramanToken(token);

  if (!result.valid) {
    return res.status(401).json({ valid: false, error: result.error });
  }

  return res.json({
    valid: true,
    address: result.address,
    faceHash: result.payload.faceHash,
    ipfsCid: result.payload.ipfsCid,
    name: result.payload.name || null,
    is_mock: result.payload.is_mock || false,
  });
});

// In-memory store for handover sessions
const handoverSessions = {};

// Helper to generate handover JWT
function generateHandoverJWT(sessionId, address, mode) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: address?.toLowerCase() || 'unknown',
    sessionId,
    mode,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(`${sessionId}_secret_sig`).toString('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

// POST /api/handover/init
app.post('/api/handover/init', (req, res) => {
  const { address, mode } = req.body;
  const sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
  const token = generateHandoverJWT(sessionId, address, mode);

  handoverSessions[sessionId] = {
    sessionId,
    address: address?.toLowerCase() || '',
    mode: mode || 'register',
    status: 'pending',
    result: null,
    createdAt: Date.now(),
  };

  return res.json({
    success: true,
    sessionId,
    handoverToken: token,
  });
});

// POST /api/handover/complete
app.post('/api/handover/complete', (req, res) => {
  const { sessionId, result } = req.body;

  if (!sessionId || !handoverSessions[sessionId]) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }

  handoverSessions[sessionId].status = 'completed';
  handoverSessions[sessionId].result = result;

  return res.json({
    success: true,
  });
});

// GET /api/handover/status/:sessionId
app.get('/api/handover/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = handoverSessions[sessionId];

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  // Cleanup sessions older than 15 minutes to save memory
  if (Date.now() - session.createdAt > 15 * 60 * 1000) {
    delete handoverSessions[sessionId];
    return res.status(410).json({ success: false, error: 'Session has timed out' });
  }

  return res.json({
    success: true,
    status: session.status,
    result: session.result,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[PramanVerifyServer] Reference server running on port ${PORT}`);
});

