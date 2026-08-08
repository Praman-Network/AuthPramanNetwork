import ethersPlugin from "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";
dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  plugins: [
    ethersPlugin
  ],
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    },
    amoy: {
      type: "http",
      url: process.env.POLYGON_AMOY_RPC || process.env.VITE_POLYGON_AMOY_RPC || "https://polygon-amoy.drpc.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
