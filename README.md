# Token Bridge Tutorial

## Setup

node > 18

install nargo with version `0.16.0-aztec.1`

```shell
noirup -v 0.16.0-aztec.1
```

run ethereum locally

```shell
anvil
```

run aztec-sandbox

```shell
npx @aztec/aztec-sandbox@0.8.14
npm install -g @aztec/cli@0.8.14
```

compile aztec L2 contract

```shell
cd aztec-contracts/token-bridge
aztec-cli compile --typescript ../../src/test/fixtures token_bridge
```

compile aztec L1 contract

```shell
cd l1-contracts
yarn hardhat compile
```
