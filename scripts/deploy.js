import fs from 'fs';
import hre from 'hardhat';

async function main() {
  console.log("Reading contract artifact...");
  const artifactPath = './artifacts/contracts/FaceRegistry.sol/FaceRegistry.json';
  if (!fs.existsSync(artifactPath)) {
    throw new Error("FaceRegistry.json artifact not found. Please run 'npx hardhat compile' first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  console.log("Connecting to network...");
  const connection = await hre.network.connect();
  const { ethers } = connection;
  
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No deployer accounts found in configuration. Check your private key in .env");
  }
  const deployer = signers[0];
  console.log(`Deploying from account: ${deployer.address}`);
  
  const FaceRegistry = await ethers.getContractFactory("FaceRegistry");
  console.log("Sending deployment transaction...");
  const contract = await FaceRegistry.deploy({
    gasLimit: 1000000,
    maxFeePerGas: ethers.parseUnits('35', 'gwei'),
    maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei')
  });
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("------------------------------------------------");
  console.log("FaceRegistry contract deployed successfully!");
  console.log(`Contract Address: ${address}`);
  console.log("------------------------------------------------");
  
  // Ensure the frontend directory exists and write the address and ABI to it
  fs.mkdirSync('./src/contracts', { recursive: true });
  const registryConfig = {
    address: address,
    abi: artifact.abi
  };
  fs.writeFileSync('./src/contracts/FaceRegistry.json', JSON.stringify(registryConfig, null, 2));
  console.log("Saved config to src/contracts/FaceRegistry.json for frontend integration.");
  
  // Also write to the SDK package directory
  fs.mkdirSync('./packages/sdk/src/contracts', { recursive: true });
  fs.writeFileSync('./packages/sdk/src/contracts/FaceRegistry.json', JSON.stringify(registryConfig, null, 2));
  console.log("Saved config to packages/sdk/src/contracts/FaceRegistry.json for SDK package.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
