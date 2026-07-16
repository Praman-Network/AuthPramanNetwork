import { ethers } from 'ethers';

/**
 * Normalizes a 128-d face descriptor array by rounding each element to 1 decimal place.
 * We use 1 decimal place (instead of 2) to drastically increase stability, ensuring that slight 
 * environmental variations in the same user's face don't produce a completely different hash.
 * This enforces strict 1 User = 1 Account sybil resistance on-chain.
 */
export function getStableVector(vector: number[] | Float32Array): number[] {
  const arr = Array.isArray(vector) ? vector : Array.from(vector);
  // We use bucket size 0.2 (multiply by 5) to drastically increase stability, ensuring that slight 
  // environmental variations in the same user's face don't produce a completely different hash.
  return arr.map((val) => Math.round(val * 5) / 5);
}

/**
 * Quantizes a Float32Array or number[] face vector into an array of integers.
 * Circom/SnarkJS does not support floating point arithmetic, so we multiply by 10^5 (100000) and round.
 */
export function quantizeFaceVector(vector: number[] | Float32Array): number[] {
  const arr = Array.isArray(vector) ? vector : Array.from(vector);
  return arr.map((val) => Math.round(val * 100000));
}

/**
 * Hashes a quantized 128-dimensional integer vector using ethers.js Keccak256.
 * Encodes the array as a standard int256[128] array to match the Solidity input representation.
 */
export function hashFaceVector(quantizedVector: number[]): string {
  if (quantizedVector.length !== 128) {
    throw new Error(`Face vector must have exactly 128 dimensions, got ${quantizedVector.length}`);
  }
  
  // Format the array as int256[128] for ABI encoding
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(['int256[128]'], [quantizedVector]);
  
  return ethers.keccak256(encoded);
}
