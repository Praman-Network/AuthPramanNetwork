# PramanAuth SDK Developer Documentation

**Status:** 🧪 Beta | **Network:** Polygon Amoy (Testnet)

Welcome to the PramanAuth SDK documentation. PramanAuth is a decentralized Identity-as-a-Service (IaaS) offering privacy-preserving, zero-knowledge (ZK) biometric authentication. 

Under the new **Web2.5 Hybrid Relayer (BaaS)** architecture, transactions are gasless, there are no MetaMask popups for the user, and all IPFS uploads/contract writes are handled securely off-chain by our backend relayer.

---

## Installation

Add the SDK package to your frontend project:

```bash
npm install @praman/sdk
```

---

## 1. Initialization

Initialize the SDK instance inside your app config or root component (compatible with both Next.js and Vite). Pass the `backendUrl` of your Backend Relayer:

```typescript
import { initPraman } from '@praman/sdk';

const praman = initPraman({
  apiKey: "pm_live_your_api_key_here",
  network: "polygon-amoy",
  backendUrl: "https://your-relayer-backend.com" // Backend Relayer URL
});
```

---

## 2. Triggering Login Flow

During login, your app scans the user's face, captures a webcam frame base64 string, and calls the SDK `login` method. The SDK generates a ZK proof locally in the browser and verifies it off-chain via your Backend Relayer.

```typescript
const handleLogin = async (webcamScreenshotBase64: string) => {
  const result = await praman.login(
    webcamScreenshotBase64,
    null,          // No MetaMask signer required!
    window.faceapi // Pass loaded faceapi instance
  );

  if (result.success) {
    console.log("Decentralized Session Token:", result.jwt);
    console.log("ZK Proof details:", result.proof);
    console.log("Is Mock Proof:", result.is_mock); // Flag representing proof authenticity
    
    // Send token to your backend server for verification!
    const response = await fetch('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ token: result.jwt }),
      headers: { 'Content-Type': 'application/json' }
    });
    const authData = await response.json();
    if (authData.valid) {
      alert("Successfully Logged In!");
    }
  } else {
    alert("Authentication failed: " + result.error);
  }
};
```

---

## 3. Triggering Registration Flow

During registration, gather user form data, scan their face, and invoke `register`. The relayer automatically pays the gas fees:

```typescript
const handleRegister = async (webcamScreenshotBase64: string, pii: { name: string, email: string, mobile: string }) => {
  const result = await praman.register(
    webcamScreenshotBase64,
    pii,
    null, // No MetaMask signer required! Gas is sponsored by Relayer.
    window.faceapi
  );

  if (result.success) {
    console.log("Registered identity session JWT:", result.jwt);
    alert("Biometric credentials registered gaslessly on-chain successfully!");
  } else {
    alert("Registration failed: " + result.error);
  }
};
```

---

## 4. Verifying Token (Client-Side & Backend)

### Client-Side Decrypt/Read
You can quickly read and verify token contents in the client browser:

```typescript
const verifyTokenResult = praman.verifyToken(token);
if (verifyTokenResult.valid) {
  console.log("Authenticated User Wallet Address:", verifyTokenResult.payload.sub);
  console.log("Is Mock Token:", verifyTokenResult.payload.is_mock);
}
```

### Backend Integration
When your backend receives the token from the client, it must decrypt and verify it.

> [!IMPORTANT]
> **Mandatory Security Rule:** Always check the `is_mock` flag in the decoded token payload on your backend. If `is_mock` is `true` in a production environment, the authentication transaction **MUST** be rejected to prevent mock-bypass exploits.

---

## Security Best Practices

### Production Hardening & Environment Guard
The PramanAuth SDK is production-hardened to prevent development simulation tools from leaking into live deployments.

> [!WARNING]
> **Environment Guard:** In production mode, the SDK enforces a strict **hard-fail** policy. If real ZK proof generation fails (due to missing static files like `.wasm`/`.zkey`, or browser resource exhaustion), it will throw a critical error rather than falling back to a mock proof. 
> 
> Ensure that your production bundler config or environment variable (`import.meta.env.MODE` for Vite or `process.env.NODE_ENV` for Node environments) is correctly set to `'production'` in your deployed builds.

---

## Privacy, Sovereignty & Zero-Knowledge Verification

PramanAuth is designed around user sovereignty and mathematical trust, ensuring that biometrics can be verified without sacrificing privacy.

*   **Zero Biometric Storage:** We do not store raw biometric data (such as images, photos, or raw face descriptors) on any centralized server or database.
*   **Decentralized Verification:** 128-dimensional quantized face vectors are converted into a Keccak256 hash. The actual mathematical verification is performed locally inside the user's browser using client-side ZK-SNARK Proving (via Groth16 SnarkJS).
*   **Cryptographic Verifiability:** Since only the zero-knowledge proof is sent for verification, your servers and the public ledger never gain visibility of the user's raw face measurements. Trust is mathematically guaranteed.
