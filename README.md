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

run test

```shell
yarn test
```

### Current Issue

```shell
 FAIL  test/cross_chain_messaging.test.ts (62.643 s)
  e2e_cross_chain_messaging
    ✕ Privately deposit funds from L1 -> L2 and withdraw back to L1 (50181 ms)

  ● e2e_cross_chain_messaging › Privately deposit funds from L1 -> L2 and withdraw back to L1


Object FunctionData not registered for serialization TO JSON

      246 |         messageKey,
      247 |         secretForL2MessageConsumption
    > 248 |       ).send();

      at convertToJsonObj (../node_modules/@aztec/foundation/src/json-rpc/convert.ts:157:13)
      at convertToJsonObj (../node_modules/@aztec/foundation/src/json-rpc/convert.ts:152:23)
      at ../node_modules/@aztec/foundation/src/json-rpc/convert.ts:144:32
          at Array.map (<anonymous>)
      at convertToJsonObj (../node_modules/@aztec/foundation/src/json-rpc/convert.ts:144:16)
      at ../node_modules/@aztec/foundation/src/json-rpc/client/json_rpc_client.ts:106:35
          at Array.map (<anonymous>)
      at request (../node_modules/@aztec/foundation/src/json-rpc/client/json_rpc_client.ts:106:22)
      at Proxy.<anonymous> (../node_modules/@aztec/foundation/src/json-rpc/client/json_rpc_client.ts:129:18)
      at ContractFunctionInteraction.create (../node_modules/@aztec/aztec.js/src/contract/contract_function_interaction.ts:48:42)
      at ContractFunctionInteraction.simulate (../node_modules/@aztec/aztec.js/src/contract/base_contract_interaction.ts:39:53)
      at ../node_modules/@aztec/aztec.js/src/contract/base_contract_interaction.ts:55:41
      at ContractFunctionInteraction.send (../node_modules/@aztec/aztec.js/src/contract/base_contract_interaction.ts:57:7)
      at CrossChainTestHarness.consumeMessageOnAztecAndMintSecretly (fixtures/cross_chain_test_harness.ts:248:9)
      at Object.<anonymous> (cross_chain_messaging.test.ts:146:33)

```

### References

- [aztec-packages/l1-contracts/test/portals/TokenPortal.sol@aztec-packages-v0.8.14](https://github.com/AztecProtocol/aztec-packages/blob/aztec-packages-v0.8.14/l1-contracts/test/portals/TokenPortal.sol)
- [yarn-project/end-to-end/src/e2e_cross_chain_messaging.test.ts](https://github.com/AztecProtocol/aztec-packages/blob/aztec-packages-v0.8.14/yarn-project/end-to-end/src/e2e_cross_chain_messaging.test.ts)
- [e2e_cross_chain_messaging-test-fix-commit](https://github.com/AztecProtocol/dev-rel/pull/82/files#diff-31f85d8b2d40b30d57fbfb8f5568de30f525c635021883db33dbf4266a2e3d9e)
- [token-bridge-contract-latest](https://github.com/AztecProtocol/aztec-packages/blob/aztec-packages-v0.8.11/yarn-project/noir-contracts/src/contracts/token_bridge_contract/src/main.nr)
