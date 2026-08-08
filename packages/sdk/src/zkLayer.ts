// @ts-ignore
import * as snarkjs from 'snarkjs';

export interface ZKProofObject {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  publicSignals: string[];
}

/**
 * Computes Euclidean distance between two 128-d quantized face vectors.
 * Returns a normalised similarity score in [0, 1] where 1 = identical.
 * Throws if the vectors are considered a mismatch (distance > threshold).
 */
function computeFaceSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  const distance = Math.sqrt(sumSq);
  // face-api.js quantized distance: same person <= 100000, different person > 100000
  const MATCH_THRESHOLD = 100000; // Correct threshold matching the 10000000000 squared limit of ZK circuit
  if (distance > MATCH_THRESHOLD) {
    throw new Error(
      `Face biometric mismatch. Euclidean distance ${Math.round(distance)} exceeds threshold ${MATCH_THRESHOLD}. ` +
      `This face does not match the registered identity. Login denied.`
    );
  }
  return 1 - distance / MATCH_THRESHOLD; // 0–1 similarity score
}

/**
 * Generates a Zero-Knowledge Face Match Proof.
 *
 * SECURITY CONTRACT:
 *  - This function THROWS if the face vectors do not match.
 *  - It NEVER returns a successful result for a mismatching face.
 *  - Real path: uses snarkjs.groth16.fullProve + validates publicSignals[0] === "1"
 *  - Fallback path: computes real Euclidean distance, throws on mismatch,
 *    only then returns a simulation proof.
 */
export async function generateZKFaceProof(
  newVector: number[],
  savedVector: number[],
  savedVectorHash: string
): Promise<{ proof: ZKProofObject; publicSignals: string[]; usedMock: boolean; is_mock: boolean }> {
  // (Removed simulated delay for better UX)

  if (!newVector || newVector.length !== 128 || !savedVector || savedVector.length !== 128) {
    throw new Error('Both new and saved vectors must be 128-dimensional quantized arrays.');
  }

  // ── ALWAYS verify biometric similarity first, regardless of ZK path ──
  // This is the primary security gate. computeFaceSimilarity throws on mismatch.
  const similarityScore = computeFaceSimilarity(newVector, savedVector);
  console.log(`[ZK] Face similarity score: ${(similarityScore * 100).toFixed(1)}%`);

  const cacheBuster = Date.now();
  const wasmPath = `/zk/face_verify.wasm?v=${cacheBuster}`;
  const zkeyPath = `/zk/face_verify.zkey?v=${cacheBuster}`;

  try {
    console.log('Attempting real client-side ZK proof generation using SnarkJS...');

    // Check if the WASM file is available first
    const wasmCheck = await fetch(wasmPath, { method: 'HEAD' });
    if (!wasmCheck.ok) {
      throw new Error('Compiled WASM circuit files not found under public/zk/');
    }

    const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
      { newVector, savedVector },
      wasmPath,
      zkeyPath
    );

    // ── Validate the ZK circuit output ──
    // publicSignals[0] must be "1" meaning the circuit verified a match
    if (!publicSignals || publicSignals[0] !== '1') {
      throw new Error(
        `ZK circuit returned no-match signal (publicSignals[0]="${publicSignals?.[0]}"). ` +
        `Face verification failed. Login denied.`
      );
    }

    return {
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: 'groth16',
        publicSignals,
      },
      publicSignals,
      usedMock: false,
      is_mock: false,
    };
  } catch (error: any) {
    // Real ZK proof generation failed. Do not fall back to mock.
    throw new Error(
      `Critical Security Error: Real ZK proof generation failed. Details: ${error?.message || error}`
    );
  }
}
