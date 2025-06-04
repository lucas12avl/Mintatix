require("@nomicfoundation/hardhat-toolbox");

const { vars } = require("hardhat/config");

let INFURA_API_KEY = "";
let SEPOLIA_PRIVATE_KEY = "";

try {
  INFURA_API_KEY = vars.get("INFURA_API_KEY");
  SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");
} catch (error) {
  console.warn("Loca mode: skip Sepolia network configuration");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  defaultNetwork: "localhost",
  networks: {
  ...(INFURA_API_KEY && SEPOLIA_PRIVATE_KEY ? {
          sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
          },
        }
    :{}),
  },
};
