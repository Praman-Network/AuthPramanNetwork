import { LitNodeClient } from '@lit-protocol/lit-node-client';

// Keep a single instance of LitNodeClient
let litNodeClientInstance: any = null;

/**
 * Helper to check environment variables across Vite, Next.js, and other builders.
 */
export function getEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key];
    if (process.env[`NEXT_PUBLIC_${key}`]) return process.env[`NEXT_PUBLIC_${key}`];
  }
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  return undefined;
}

/**
 * Helper to derive an AES-GCM CryptoKey from a signature string using SHA-256.
 */
async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const signatureBytes = enc.encode(signature);
  const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM with a wallet-signature derived key.
 */
async function encryptWithWalletSignature(data: string, signature: string): Promise<string> {
  const key = await deriveKeyFromSignature(signature);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data)
  );
  
  const result = {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
    iv: btoa(String.fromCharCode(...iv))
  };
  return btoa(JSON.stringify(result));
}

/**
 * Decrypts a base64 string using AES-GCM with a wallet-signature derived key.
 */
async function decryptWithWalletSignature(encryptedBase64: string, signature: string): Promise<string> {
  const rawJson = atob(encryptedBase64);
  const { ciphertext, iv } = JSON.parse(rawJson);
  
  const key = await deriveKeyFromSignature(signature);
  const ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
  const ciphertextBytes = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  );
  
  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Initializes and connects to the Lit Node Client.
 * Targets the 'datil-dev' network.
 */
export async function getLitClient(): Promise<any> {
  if (litNodeClientInstance) return litNodeClientInstance;

  try {
    const client = new LitNodeClient({
      litNetwork: 'datil-dev',
      debug: true, // Enabled for troubleshooting node connection URLs in browser console
      connectTimeout: 40000, // Increased timeout for slow network handshakes
    });
    await client.connect();
    litNodeClientInstance = client;
    return client;
  } catch (error) {
    console.error('Failed to connect to Lit Node Client:', error);
    throw error;
  }
}

/**
 * Generates the Access Control Conditions (ACC).
 * Allows decryption ONLY by:
 * 1. The user's wallet address at encryption time.
 * 2. The admin's wallet address.
 */
export function getAccessControlConditions(userAddress: string, adminAddress: string) {
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: userAddress,
      },
    },
    {
      operator: 'or',
    },
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: adminAddress,
      },
    },
  ];
}

/**
 * Encrypts the user's PII in the browser strictly using Lit Protocol,
 * or fallback client-side AES-GCM if VITE_BYPASS_LIT is enabled.
 */
export async function encryptPII(
  pii: { name: string; email: string; mobile: string },
  userAddress: string,
  adminAddress: string,
  authSig: any
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  if (!authSig) {
    throw new Error('PramanAuth [Fatal]: Lit Protocol AuthSig is required for secure decentralized encryption.');
  }

  const dataString = JSON.stringify(pii);
  const bypassLit = getEnvVar('VITE_BYPASS_LIT') === 'true' || getEnvVar('BYPASS_LIT') === 'true';

  if (bypassLit) {
    console.log('[PramanSDK] VITE_BYPASS_LIT option detected. Using client-side wallet-signature AES-GCM encryption.');
    const realCiphertext = await encryptWithWalletSignature(dataString, authSig.sig);
    const mockHash = '0x' + Array.from(realCiphertext).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '');
    return {
      ciphertext: realCiphertext,
      dataToEncryptHash: mockHash.slice(0, 66).padEnd(66, '0'),
    };
  }

  const client = await getLitClient();
  const accessControlConditions = getAccessControlConditions(userAddress, adminAddress);

  const encryptionResult = await client.encryptString({
    accessControlConditions,
    authSig,
    chain: 'ethereum',
    dataToEncrypt: dataString,
  });

  if (!encryptionResult || (!encryptionResult.ciphertext && !encryptionResult.encryptedString)) {
    throw new Error('PramanAuth [Fatal]: Lit Protocol encryption returned an empty response.');
  }

  return {
    ciphertext: encryptionResult.ciphertext || encryptionResult.encryptedString,
    dataToEncryptHash: encryptionResult.dataToEncryptHash,
  };
}

/**
 * Decrypts the user's PII strictly using Lit Protocol,
 * or fallback client-side AES-GCM if VITE_BYPASS_LIT is enabled.
 */
export async function decryptPII(
  ciphertext: string,
  dataToEncryptHash: string,
  userAddress: string,
  adminAddress: string,
  authSig: any
): Promise<{ name: string; email: string; mobile: string }> {
  if (!authSig) {
    throw new Error('PramanAuth [Fatal]: Lit Protocol AuthSig is required for decryption.');
  }

  const bypassLit = getEnvVar('VITE_BYPASS_LIT') === 'true' || getEnvVar('BYPASS_LIT') === 'true';

  if (bypassLit) {
    console.log('[PramanSDK] VITE_BYPASS_LIT option detected. Using client-side wallet-signature AES-GCM decryption.');
    const decryptedString = await decryptWithWalletSignature(ciphertext, authSig.sig);
    return JSON.parse(decryptedString);
  }

  const client = await getLitClient();
  const accessControlConditions = getAccessControlConditions(userAddress, adminAddress);

  const decryptedString = await client.decryptString({
    accessControlConditions,
    authSig,
    chain: 'ethereum',
    ciphertext,
    dataToEncryptHash,
  });

  return JSON.parse(decryptedString);
}

/**
 * Uploads the encrypted payload JSON to IPFS via Pinata.
 * Strictly requires Pinata API credentials or throws a fatal error.
 */
export async function uploadToIPFS(payload: {
  ciphertext: string;
  dataToEncryptHash: string;
  faceDescriptorHash: string;
  userAddress: string;
}): Promise<{ cid: string }> {
  const jwt = getEnvVar('PINATA_JWT') || getEnvVar('VITE_PINATA_JWT') || getEnvVar('PINATA_API_KEY');
  if (!jwt) {
    throw new Error("PramanAuth [Fatal]: PINATA_API_KEY is missing. Cannot proceed with decentralized storage.");
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: payload,
      pinataMetadata: {
        name: `pramanauth_${payload.userAddress.slice(0, 8)}.json`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PramanAuth [Fatal]: Pinata upload failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return { cid: data.IpfsHash };
}

/**
 * Fetches the encrypted payload JSON from IPFS using the CID.
 */
export async function fetchFromIPFS(cid: string): Promise<any> {
  // Use public gateways as fallbacks to ensure robust lookup
  const gateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/'
  ];

  let lastError: any = null;

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(`PramanAuth [Fatal]: Failed to fetch payload from IPFS for CID ${cid}. Last error: ${lastError?.message || 'Gateway unreachable'}`);
}

/**
 * Generates an AuthSig manually by requesting a personal sign from the connected wallet.
 * This conforms to standard EIP-4361 SIWE formatting required by Lit Protocol.
 */
export async function getManualAuthSig(signer: any): Promise<any> {
  const address = await signer.getAddress();
  const domain = (typeof window !== 'undefined' && window.location) ? window.location.hostname : 'localhost';
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:5173';
  const statement = 'Sign in to PramanAuth to authorize access control conditions.';
  
  const bypassLit = getEnvVar('VITE_BYPASS_LIT') === 'true' || getEnvVar('BYPASS_LIT') === 'true';
  const nonce = bypassLit ? 'pramanauth_stable_nonce' : Math.random().toString(36).substring(2, 10);
  const issuedAt = bypassLit ? '2026-06-28T12:00:00.000Z' : new Date().toISOString();

  const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

  const signature = await signer.signMessage(message);

  return {
    sig: signature,
    derivedVia: 'web3.eth.personal.sign',
    signedMessage: message,
    address,
  };
}

/**
 * Generates an AuthSig with 'permission' scope to authorize decryption of sensitive PII.
 */
export async function getPermissionAuthSig(signer: any): Promise<any> {
  const address = await signer.getAddress();
  const domain = (typeof window !== 'undefined' && window.location) ? window.location.hostname : 'localhost';
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:5173';
  const statement = 'Authorize PramanAuth to access sensitive data (email and mobile phone). Scope: permission';
  
  const bypassLit = getEnvVar('VITE_BYPASS_LIT') === 'true' || getEnvVar('BYPASS_LIT') === 'true';
  const nonce = bypassLit ? 'pramanauth_stable_nonce' : Math.random().toString(36).substring(2, 10);
  const issuedAt = bypassLit ? '2026-06-28T12:00:00.000Z' : new Date().toISOString();

  const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

  const signature = await signer.signMessage(message);

  return {
    sig: signature,
    derivedVia: 'web3.eth.personal.sign',
    signedMessage: message,
    address,
  };
}
