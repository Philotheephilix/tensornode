require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
// Import dotenv module to access variables stored in the .env file
require("dotenv").config();

// Define Hardhat tasks here, which can be accessed in our test file (test/rpc.js) by using hre.run('taskName')
task("show-balance", async () => {
  const showBalance = require("./scripts/showBalance");
  return showBalance();
});

task("deploy-contract", async () => {
  const deployContract = require("./scripts/deployContract");
  return deployContract();
});

task("contract-view-call", async (taskArgs) => {
  const contractViewCall = require("./scripts/contractViewCall");
  return contractViewCall(taskArgs.contractAddress);
});

task("contract-call", async (taskArgs) => {
  const contractCall = require("./scripts/contractCall");
  return contractCall(taskArgs.contractAddress, taskArgs.msg);
});

// New task: runs create, mint, and transfer in one go
// Usage example:
// npx hardhat hts-flow --contract-address 0x... --name MyToken --symbol MTK --mint 1000 --recipients 0xabc,0xdef --amounts 500,500
//
task("hts-flow", async (taskArgs) => {
  const htsFlow = require("./scripts/htsFlow");
  return htsFlow(
    taskArgs.contractAddress,
    taskArgs.name,
    taskArgs.symbol,
    taskArgs.mint,
    taskArgs.recipients,
    taskArgs.amounts
  );
}).addParam("contractAddress")
  .addParam("name")
  .addParam("symbol")
  .addParam("mint")
  .addParam("recipients")
  .addParam("amounts");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: {
    timeout: 3600000,
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  // This specifies network configurations used when running Hardhat tasks
  defaultNetwork: "testnet",
  networks: {
    testnet: {
      url: "https://testnet.hashio.io/api",
      accounts: ["0x45acabdc0627f998e56fa584180466883e3f9ecfe825d052ab3fca9e44fc83b6"],
    },
  },
};
