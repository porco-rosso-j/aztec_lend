# AztecLend

Built at ETH Global Online 2023: [Project page](https://ethglobal.com/showcase/azteclend-fpkys)

## Overview

AztecLend allows for private lending operations to DeFi lending protocol, such as Spark(Savings DAI) and Compound from Aztec, a private zk-rollup.

AztecLend contract on Aztec L2 acts like a strategy vault that receives deposits, bridges the token, and has the AztecLend contract on L1 execute a requested strategy.

Users can receive/redeem wrapped share tokens, such as sDAI, cUSDC, and aWETH, directly from Aztec bridge on L2 in a private(optional) manner.

## Technologies

- [Aztec](https://aztec.network/): [Noir](https://noir-lang.org/) and [SandBox](https://docs.aztec.network/dev_docs/getting_started/sandbox)
- [Spark Protocol](https://spark.fi/): [sDAI](https://docs.spark.fi/defi-infrastructure/sdai-overview)(SavingsDAI)
- [Compound](https://compound.finance/): Compound V2

## Setup

node > 18

nargo `v0.16.0-aztec.1`

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

### Test

```shell
cd aztec-contracts
aztec-cli compile ./ --typescript ../src/test/fixtures/
```

```shell
cd src
yarn test
```

### Frontend

```shell
cd aztec-contracts
aztec-cli compile ./ --typescript ../front/scripts/artifacts/
```

```shell
cd front
yarn
yarn start
```
