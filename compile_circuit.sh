#!/bin/bash

# Create build and target public directories
mkdir -p build
mkdir -p public/zk

echo "Compiling Circom circuit..."
# Compile circuit to generate R1CS and WASM
./bin/circom circuits/face_verify.circom --r1cs --wasm --sym --output build

echo "Performing setup for Groth16 (Powers of Tau)..."
# Start a new powers of tau ceremony (use 14 constraints power, suitable for size of 128 elements)
npx snarkjs powersoftau new bn128 14 build/pot14_0000.ptau -v
# Contribute to the ceremony
npx snarkjs powersoftau contribute build/pot14_0000.ptau build/pot14_0001.ptau --name="Contributor 1" -v -e="some random entropy text"
# Prepare phase 2
npx snarkjs powersoftau prepare phase2 build/pot14_0001.ptau build/pot14_final.ptau -v

echo "Generating zkey..."
# Setup circuit groth16 key
npx snarkjs groth16 setup build/face_verify.r1cs build/pot14_final.ptau build/face_verify_0000.zkey
# Contribute to the circuit zkey
npx snarkjs zkey contribute build/face_verify_0000.zkey build/face_verify_final.zkey --name="Contributor 2" -v -e="another random signature entropy"
# Export verification key
npx snarkjs zkey export verificationkey build/face_verify_final.zkey build/verification_key.json

echo "Copying files to public directory..."
# Copy compiled WASM and final zkey to public folder for browser-side snarkjs proof generation
cp build/face_verify_js/face_verify.wasm public/zk/face_verify.wasm
cp build/face_verify_final.zkey public/zk/face_verify.zkey
cp build/verification_key.json public/zk/verification_key.json

echo "ZK circuit compilation and setup completed successfully!"
