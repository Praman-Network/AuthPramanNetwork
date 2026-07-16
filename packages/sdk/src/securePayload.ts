import { ethers } from 'ethers';

export interface VerificationResult {
  isVerified: boolean;
  faceHash?: string;
  zkProof?: any;
}

export interface SecuredPayload {
  payload: VerificationResult;
  timestamp: number;
  nonce: string;
  signature: string;
  signerAddress: string;
}

/**
 * Signs the verification result using a client-side provider/wallet to prevent network tampering.
 */
export async function generateSecurePayload(
  result: VerificationResult,
  signer: ethers.Signer
): Promise<SecuredPayload> {
  const timestamp = Date.now();
  const nonce = ethers.hexlify(ethers.randomBytes(16)); // generate 16 random bytes

  const payloadString = JSON.stringify(result);
  
  // The message strictly defines the session constraints
  const messageToSign = `PRAMAN_AUTH_VERIFICATION\nPayload:${payloadString}\nTimestamp:${timestamp}\nNonce:${nonce}`;

  // Cryptographically sign the message to ensure it cannot be modified over the wire
  const signature = await signer.signMessage(messageToSign);
  const signerAddress = await signer.getAddress();

  return {
    payload: result,
    timestamp,
    nonce,
    signature,
    signerAddress
  };
}
