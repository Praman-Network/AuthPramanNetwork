import * as snarkjs from 'snarkjs';
import fs from 'fs';

async function run() {
  const newVector = Array(128).fill(0);
  const savedVector = Array(128).fill(0);
  
  // Create a small difference to test
  newVector[0] = -20000;
  savedVector[0] = -40000;

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      { newVector, savedVector },
      "apps/identity-provider/public/zk/face_verify.wasm",
      "apps/identity-provider/public/zk/face_verify.zkey"
    );
    console.log("SUCCESS:", publicSignals[0]);
  } catch (e) {
    console.error("ERROR:", e);
  }
}
run();
