require("@nomicfoundation/hardhat-toolbox");

const { vars } = require("hardhat/config");

const INFURA_API_KEY = vars.get("INFURA_API_KEY") || "";
;
const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY") || "";
;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  defaultNetwork: "localhost",
  networks: {
    ...(SEPOLIA_PRIVATE_KEY && INFURA_API_KEY)?{
      sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY],
      },
    }:{}  
  },
};
