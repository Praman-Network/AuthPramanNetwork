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
  // face-api.js quantized distance: same person <= 60000 (0.6 float), different person > 60000
  const MATCH_THRESHOLD = 60000; // Correct threshold matching the 3,600,000,000 squared limit of ZK circuit
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
  // Simulate processing delay (mimicking client-side WASM compute time)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (!newVector || newVector.length !== 128 || !savedVector || savedVector.length !== 128) {
    throw new Error('Both new and saved vectors must be 128-dimensional quantized arrays.');
  }

  // ── ALWAYS verify biometric similarity first, regardless of ZK path ──
  // This is the primary security gate. computeFaceSimilarity throws on mismatch.
  const similarityScore = computeFaceSimilarity(newVector, savedVector);
  console.log(`[ZK] Face similarity score: ${(similarityScore * 100).toFixed(1)}%`);

  const wasmPath = '/zk/face_verify.wasm';
  const zkeyPath = '/zk/face_verify.zkey';

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
    // If this is a face-mismatch error, re-throw it — do NOT fall back to mock
    if (
      error?.message?.includes('mismatch') ||
      error?.message?.includes('Login denied') ||
      error?.message?.includes('verification failed')
    ) {
      throw error;
    }

    // Environment-Aware Security Guard
    const isProduction = typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'production';
    if (isProduction) {
      throw new Error(
        `Critical Security Error: Real ZK proof generation failed in production mode. ` +
        `Mock proof generation is disabled. Details: ${error?.message || error}`
      );
    }

    // ZK circuit files missing — fall back to simulation proof
    // Face similarity was already verified above, so this is safe
    console.warn('⚠️ SECURITY WARNING: Using mock ZK-Proof in development mode.');

    const matchSignal = '1'; // We already passed computeFaceSimilarity above
    const publicSignals = [
      matchSignal,
      `0x${Math.floor(similarityScore * 1e10).toString(16).padStart(64, '0')}`,
      savedVectorHash,
      '3600000000',
    ];

    const mockProof: ZKProofObject = {
      pi_a: [
        '0x1ad34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1',
        '0x2bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d2',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ],
      pi_b: [
        [
          '0x3bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d3',
          '0x4bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d4',
        ],
        [
          '0x5bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d5',
          '0x6bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d6',
        ],
        [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      ],
      pi_c: [
        '0x7bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d7',
        '0x8bd34b2f4c9a8d76e4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d8',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ],
      protocol: 'groth16',
      publicSignals,
    };

    return {
      proof: mockProof,
      publicSignals,
      usedMock: true,
      is_mock: true,
    };
  }
}
