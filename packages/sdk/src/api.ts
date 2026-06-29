import { getPramanClient } from './client';

/**
 * Sends the ZK proof/user data to the backend for verification.
 * 
 * @param userAddress The blockchain wallet address of the user.
 * @param zkProof The cryptographic zero-knowledge proof.
 * @param publicSignals The public signals array associated with the proof.
 * @param is_mock Optional boolean to specify if this is a mock verification request.
 * @returns A promise resolving to the verification response.
 */
export async function verifyZKProof(
  userAddress: string,
  zkProof: any,
  publicSignals: any[],
  is_mock?: boolean
): Promise<any> {
  const client = getPramanClient();
  return client.verifyZKProof(userAddress, zkProof, publicSignals, is_mock);
}

/**
 * Sends the ZK proof/user data to the backend to complete user login.
 * Matches verifyZKProof functionality.
 * 
 * @param userAddress The blockchain wallet address of the user.
 * @param zkProof The cryptographic zero-knowledge proof.
 * @param publicSignals The public signals array associated with the proof.
 * @param is_mock Optional boolean to specify if this is a mock verification request.
 * @returns A promise resolving to the verification response.
 */
export async function loginWithPraman(
  userAddress: string,
  zkProof: any,
  publicSignals: any[],
  is_mock?: boolean
): Promise<any> {
  const client = getPramanClient();
  return client.verifyZKProof(userAddress, zkProof, publicSignals, is_mock);
}
