# PramanAuth SDK Developer Documentation

Welcome to the PramanAuth SDK documentation. PramanAuth is a decentralized Identity-as-a-Service (IaaS) offering privacy-preserving, zero-knowledge biometric authentication.

## Installation

Add the SDK package to your frontend project:

```bash
npm install @praman/sdk
```

---

## 1. Initialization

Initialize the SDK instance inside your app config or root component (compatible with both Next.js and Vite):

```typescript
import { initPraman } from '@praman/sdk';

const praman = initPraman({
  apiKey: "pm_live_your_api_key_here",
  network: "polygon-amoy", // or local
  webhookUrl: "https://your-backend.com/api/praman-events" // optional billing/analytics tracking
});
```

---

## 2. Triggering Login Flow

During login, your app scans the user's face, gets a webcam frame base64 string, and calls the SDK `login` method:

```typescript
import { useWallet } from './your-wallet-context'; // get signer / provider

const handleLogin = async (webcamScreenshotBase64: string) => {
  const result = await praman.login(
    webcamScreenshotBase64,
    signer,
    window.faceapi // pass loaded faceapi instance
  );

  if (result.success) {
    console.log("Decentralized Session Token:", result.jwt);
    console.log("ZK proof generated:", result.proof);
    
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

During registration, gather user form data, scan their face, and invoke `register`:

```typescript
const handleRegister = async (webcamScreenshotBase64: string, pii: { name: string, email: string, mobile: string }) => {
  const result = await praman.register(
    webcamScreenshotBase64,
    pii,
    signer,
    window.faceapi
  );

  if (result.success) {
    console.log("Registered identity session JWT:", result.jwt);
    alert("Biometric credentials registered on-chain successfully!");
  } else {
    alert("Registration failed: " + result.error);
  }
};
```

---

## 4. Verifying Token (Client-Side)

You can quickly read and verify token contents in the client browser:

```typescript
const verifyTokenResult = praman.verifyToken(token);
if (verifyTokenResult.valid) {
  console.log("Authenticated User Wallet Address:", verifyTokenResult.payload.sub);
}
```
