require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: "http://127.0.0.1:8545/",
        blockNumber: 18381018
      },
      throwOnCallFailures: true,
      throwOnTransactionFailures: true       
    },
    anvil: {
      url: "http://127.0.0.1:8545/"

    }
  }
};
