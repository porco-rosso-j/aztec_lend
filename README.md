# AztecLend

## Overview

AztecLend allows for private lending operation to DeFi lending protocol, such as Spark and Compound from Aztec, private L2 zk-rollup. AztecLend contract on Aztec L2 acts like strategy vault that receives deposits, bridge the token, and have the Aztec contract on L1 execute a requested strategy. Subsequently, users can receive/redeem wrapped share tokens, such as sDAI, aWETH, and cUSDC, directly from Aztec bridge on L2.
git

## Setup

```shell
anvil --fork-url <RPC_URL> --fork-block-number 18077352 --chain-id 31337
```

```shell
npx @aztec/aztec-sandbox@0.9.0
```

## issue

```shell
  at Object.<anonymous> (shared/savings_dai_l1_l2.ts:639:12)

 FAIL  test/savings_dai_deposit.test.ts (195.956 s)
  savings_dai_on_l1_from_l2
    ✕ should deposit on L1 from L2 funds publicly (swaps WETH -> DAI) (88619 ms)
    ○ skipped should deposit on L1 from L2 funds privately

  ● savings_dai_on_l1_from_l2 › should deposit on L1 from L2 funds publicly (swaps WETH -> DAI)

    ContractFunctionExecutionError: The contract function "depositPublic" reverted with the following signature:
    0xfb4fb506

    Unable to decode signature "0xfb4fb506" as it was not found on the provided ABI.
    Make sure you are using the correct ABI and that the error exists on it.
    You can look up the decoded signature here: https://openchain.xyz/signatures?query=0xfb4fb506.

    Contract Call:
      address:   0xaa5c5496e2586f81d8d2d0b970eb85ab088639c2
      function:  depositPublic(address _inputTokenPortal, uint256 _inAmount, address _outputTokenPortal, bytes32 _aztecRecipient, bytes32 _secretHashForL1ToL2Message, uint32 _deadlineForL1ToL2Message, address _canceller, bool _withCaller)
      args:                   (0xc0340c0831aa40a0791cf8c3ab4287eb0a9705d8, 1000000000000000000000, 0x3818eab6ca8bf427222bfacfa706c514145f4104, 0x156a8487822095da50b22ae7b560e84550f581df4b1216590589a475f7b7d291, 0x13062f0e2396eac23b3b336b6e57ea8a4e971b784777550d9385748ab12efd29, 4294967295, 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266, true)
      sender:    0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

```

0xfb4fb506 is the error signature found in outbox contract, ` error Outbox__NothingToConsume(bytes32 entryKey)`. [\*see](https://github.com/AztecProtocol/aztec-packages/blob/7042bc6130f8473b6c59bf9a0146ea8b2c3c7483/l1-contracts/src/core/libraries/Errors.sol#L39).

This indicates something goes wrong in [`registry.getOutbox().consume(...)`](https://github.com/porco-rosso-j/aztec-lend/blob/d59fb120c8a73ba8074a8f685a298dda356580df/l1-contracts/contracts/spark/SavingsDAIPortal.sol#L96) func of Portal's deposit functions.
