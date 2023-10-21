// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRegistry} from "@aztec/l1-contracts/src/core/interfaces/messagebridge/IRegistry.sol";
import {DataStructures} from "@aztec/l1-contracts/src/core/libraries/DataStructures.sol";
import {Hash} from "@aztec/l1-contracts/src/core/libraries/Hash.sol";
import {TokenPortal} from "./TokenPortal.sol";
import {ISavingsDai} from "./interfaces/ISavingsDai.sol";
import {IcUsdc} from "./interfaces/IcUsdc.sol";

/**
 * @notice A portal that allows users to deposit DAI into Spark and USDC into Compound V2 from Aztec.
 */
contract AztecLendPortal {
    ISavingsDai public constant sDAI =
        ISavingsDai(0x83F20F44975D03b1b09e64809B757c47f942BEeA);
    address public constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    IcUsdc public constant cUSDC =
        IcUsdc(0x39AA39c021dfbaE8faC545936693aC917d5E7563);
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    error UnsupportedAsset(IERC20);

    IRegistry public registry;
    bytes32 public l2StrategyAddress;

    function initialize(
        address _registry,
        bytes32 _l2StrategyAddress
    ) external {
        registry = IRegistry(_registry);
        l2StrategyAddress = _l2StrategyAddress;
    }

    /**
     * @notice Exit with funds from L2, deposit into vault, and send vault token to L2 again publicly
     * @param _inputTokenPortal - The ethereum address of the input token portal
     * @param _inAmount - The amount of assets to deposit (same amount as withdrawn from L2)
     * @param _outputTokenPortal - The ethereum address of the output token portal
     * @param _aztecRecipient - The aztec address to receive the output assets
     * @param _secretHashForL1ToL2Message - The hash of the secret consumable message. The hash should be 254 bits (so it can fit in a Field element)
     * @param _deadlineForL1ToL2Message - deadline for when the L1 to L2 message (to mint outpiut assets in L2) must be consumed by
     * @param _canceller - The ethereum address that can cancel the deposit
     * @param _withCaller - When true, using `msg.sender` as the caller, otherwise address(0)
     * @return The entryKey of the deposit transaction in the Inbox
     */
    function depositPublic(
        address _inputTokenPortal, // portal DAI, USDC
        uint256 _inAmount,
        address _outputTokenPortal, // portal sDAI, cUSDC
        bytes32 _aztecRecipient, // our aztec contract
        bytes32 _secretHashForL1ToL2Message,
        uint32 _deadlineForL1ToL2Message,
        address _canceller,
        bool _withCaller
    ) public payable returns (bytes32) {
        IERC20 inputAsset = TokenPortal(_inputTokenPortal).underlying();
        IERC20 outputAsset = TokenPortal(_outputTokenPortal).underlying();

        // Withdraw the input asset from the portal
        TokenPortal(_inputTokenPortal).withdraw(address(this), _inAmount, true);
        // prevent stack too deep errors
        bytes32 contentHash = Hash.sha256ToField(
            abi.encodeWithSignature(
                "depositPublic(address,uint256,address,bytes32,bytes32,uint32,address,bool)",
                _inputTokenPortal,
                _inAmount,
                _outputTokenPortal,
                _aztecRecipient,
                _secretHashForL1ToL2Message,
                _deadlineForL1ToL2Message,
                _canceller,
                _withCaller ? msg.sender : address(0)
            )
        );

        // Consume the message from the outbox
        registry.getOutbox().consume(
            DataStructures.L2ToL1Msg({
                sender: DataStructures.L2Actor(l2StrategyAddress, 1),
                recipient: DataStructures.L1Actor(address(this), block.chainid),
                content: contentHash
            })
        );

        uint256 amountOut = _depositInternal(inputAsset, _inAmount);

        // approve the output token portal to take funds from this contract
        outputAsset.approve(address(_outputTokenPortal), amountOut);

        // Deposit the output asset to the L2 via its portal
        return
            TokenPortal(_outputTokenPortal).depositToAztecPublic{
                value: msg.value
            }(
                _aztecRecipient,
                amountOut,
                _canceller,
                _deadlineForL1ToL2Message,
                _secretHashForL1ToL2Message
            );
    }

    /**
     * @notice Exit with funds from L2, deposit into vault, and send vault token to L2 again privately
     * @param _inputTokenPortal - The ethereum address of the input token portal
     * @param _inAmount - The amount of assets to deposit (same amount as withdrawn from L2)
     * @param _outputTokenPortal - The ethereum address of the output token portal
     * @param _secretHashForRedeemingMintedNotes - The hash of the secret to redeem minted notes privately on Aztec. The hash should be 254 bits (so it can fit in a Field element)
     * @param _secretHashForL1ToL2Message - The hash of the secret consumable message. The hash should be 254 bits (so it can fit in a Field element)
     * @param _deadlineForL1ToL2Message - deadline for when the L1 to L2 message (to mint outpiut assets in L2) must be consumed by
     * @param _canceller - The ethereum address that can cancel the deposit
     * @param _withCaller - When true, using `msg.sender` as the caller, otherwise address(0)
     * @return The entryKey of the deposit transaction in the Inbox
     */
    function depositPrivate(
        address _inputTokenPortal,
        uint256 _inAmount,
        address _outputTokenPortal,
        bytes32 _secretHashForRedeemingMintedNotes,
        bytes32 _secretHashForL1ToL2Message,
        uint32 _deadlineForL1ToL2Message,
        address _canceller,
        bool _withCaller
    ) public payable returns (bytes32) {
        IERC20 inputAsset = TokenPortal(_inputTokenPortal).underlying();
        IERC20 outputAsset = TokenPortal(_outputTokenPortal).underlying();

        // Withdraw the input asset from the portal
        TokenPortal(_inputTokenPortal).withdraw(address(this), _inAmount, true);
        bytes32 contentHash = Hash.sha256ToField(
            abi.encodeWithSignature(
                "depositPrivate(address,uint256,address,bytes32,bytes32,uint32,address,bool)",
                _inputTokenPortal,
                _inAmount,
                _outputTokenPortal,
                _secretHashForRedeemingMintedNotes,
                _secretHashForL1ToL2Message,
                _deadlineForL1ToL2Message,
                _canceller,
                _withCaller ? msg.sender : address(0)
            )
        );

        // Consume the message from the outbox
        registry.getOutbox().consume(
            DataStructures.L2ToL1Msg({
                sender: DataStructures.L2Actor(l2StrategyAddress, 1),
                recipient: DataStructures.L1Actor(address(this), block.chainid),
                content: contentHash
            })
        );

        uint256 amountOut = _depositInternal(inputAsset, _inAmount);

        // approve the output token portal to take funds from this contract
        // Note, safeApprove was deprecated from Oz
        outputAsset.approve(address(_outputTokenPortal), amountOut);

        // Deposit the output asset to the L2 via its portal
        return
            TokenPortal(_outputTokenPortal).depositToAztecPrivate{
                value: msg.value
            }(
                _secretHashForRedeemingMintedNotes,
                amountOut,
                _canceller,
                _deadlineForL1ToL2Message,
                _secretHashForL1ToL2Message
            );
    }

    // Deposit or withdraw depending on the asset provided
    function _depositInternal(
        IERC20 inAsset,
        uint256 inAmount
    ) private returns (uint256 outAmount) {
        if (address(inAsset) == DAI) {
            inAsset.approve(address(sDAI), inAmount);
            outAmount = sDAI.deposit(inAmount, address(this));
        } else if (address(inAsset) == USDC) {
            uint256 balanceBefore = cUSDC.balanceOf(address(this));

            inAsset.approve(address(cUSDC), inAmount);
            require(cUSDC.mint(inAmount) == 0);

            uint256 balanceAfter = cUSDC.balanceOf(address(this));
            outAmount = balanceAfter - balanceBefore;
        } else if (address(inAsset) == address(sDAI)) {
            outAmount = sDAI.redeem(inAmount, address(this), address(this));
        } else if (address(inAsset) == address(cUSDC)) {
            uint256 balanceBefore = IERC20(USDC).balanceOf(address(this));

            require(cUSDC.redeem(inAmount) == 0);

            uint256 balanceAfter = IERC20(USDC).balanceOf(address(this));
            outAmount = balanceAfter - balanceBefore;
        } else {
            revert UnsupportedAsset(inAsset);
        }
    }
}
