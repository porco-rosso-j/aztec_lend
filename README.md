# AztecLend

## Overview

AztecLend allows for private lending operation to DeFi lending protocol, such as Spark and Compound from Aztec, private L2 zk-rollup. AztecLend contract on Aztec L2 acts like strategy vault that receives deposits, bridge the token, and have the Aztec contract on L1 execute a requested strategy. Subsequently, users can receive/redeem wrapped share tokens, such as sDAI, aWETH, and cUSDC, directly from Aztec bridge on L2.
git

## Setup

node > 18

```shell
anvil --fork-url <RPC_URL> --fork-block-number 18380756 --chain-id 31337
```

```shell
npm i -g @aztec/aztec-sandbox@0.9.0
npx @aztec/aztec-sandbox@0.9.0
```

```shell
cd l1-contracts
yarn hardhat compile
```

```shell
cd aztec-contracts
aztec-cli compile ./ --typescript ../src/test/fixtures/
```

```shell
yarn test
```
