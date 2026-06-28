const hre = require("hardhat");

async function main() {
  console.log("Compiling and deploying FaceRegistry contract...");

  const FaceRegistry = await hre.ethers.getContractFactory("FaceRegistry");
  const registry = await FaceRegistry.deploy();

  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("------------------------------------------------");
  console.log("FaceRegistry contract deployed successfully!");
  console.log(`Contract Address: ${address}`);
  console.log("------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
