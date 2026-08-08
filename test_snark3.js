import * as snarkjs from 'snarkjs';
import fs from 'fs';

async function run() {
  const newVector = Array(128).fill(0);
  const savedVector = Array(128).fill(0);
  
  // Create sumSq = 100000^2 = 10000000000
  newVector[0] = 100000;
  
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      { newVector, savedVector },
      "apps/identity-provider/public/zk/face_verify.wasm",
      "apps/identity-provider/public/zk/face_verify.zkey"
    );
    console.log("SUCCESS EXACT THRESHOLD:", publicSignals[0]);
  } catch (e) {
    console.error("ERROR EXACT:", e.message);
  }

  // Create sumSq = 100000^2 + 1 = 10000000001
  newVector[0] = 100000;
  newVector[1] = 1;
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      { newVector, savedVector },
      "apps/identity-provider/public/zk/face_verify.wasm",
      "apps/identity-provider/public/zk/face_verify.zkey"
    );
    console.log("SUCCESS OVER THRESHOLD:", publicSignals[0]);
  } catch (e) {
    console.error("ERROR OVER THRESHOLD:", e.message);
  }
}
run();
