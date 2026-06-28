# Backend Verification Reference Implementation

This directory contains a lightweight, zero-dependency (other than Express and Ethers) reference backend implementation that developers can run or integrate directly into their existing backend services to verify PramanAuth JWTs.

## How it Works

1. The frontend authenticates a user's biometrics against their ZK template.
2. The PramanAuth SDK generates a decentralized token: a JSON Web Token payload containing the user's wallet address (`sub`), face descriptor hash, and IPFS metadata CID.
3. The token is cryptographically signed using the user's Metamask private key (via web3 personal sign).
4. Your frontend sends this token to your backend.
5. Your backend decodes the payload, checks expiration, and recovers the wallet address from the signature using `ethers.verifyMessage`. No API keys or centralized database calls are needed on the verification critical path!

## Run Reference Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Submit a token via POST to verify:
   ```bash
   curl -X POST http://localhost:4000/verify \
     -H "Content-Type: application/json" \
     -d '{"token": "your_token_here"}'
   ```
