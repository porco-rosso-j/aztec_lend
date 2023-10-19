pragma solidity >=0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IRegistry} from "@aztec/l1-contracts/src/core/interfaces/messagebridge/IRegistry.sol";
import {DataStructures} from "@aztec/l1-contracts/src/core/libraries/DataStructures.sol";
import {Hash} from "@aztec/l1-contracts/src/core/libraries/Hash.sol";

// docs:start:setup
import {TokenPortal} from "../TokenPortal.sol";
import {ISavingsDai} from "./interfaces/ISavingsDai.sol";

/**
 * @title UniswapPortal
 * @author Aztec Labs
 * @notice A minimal portal that allow an user inside L2, to withdraw asset A from the Rollup
 * swap asset A to asset B, and deposit asset B into the rollup again.
 * Relies on Uniswap for doing the swap, TokenPortals for A and B to get and send tokens
 * and the message boxes (inbox & outbox).
 */
contract SavingsDaiPortal {
    ISavingsDai public constant sDAI =
        ISavingsDai(0x83F20F44975D03b1b09e64809B757c47f942BEeA);

    IRegistry public registry;
    bytes32 public l2StrategyAddress;

    function initialize(
        address _registry,
        bytes32 _l2StrategyAddress
    ) external {
        registry = IRegistry(_registry);
        l2StrategyAddress = _l2StrategyAddress;
    }

    // Using a struct here to avoid stack too deep errors
    struct LocalSwapVars {
        IERC20 inputAsset;
        IERC20 outputAsset;
        bytes32 contentHash;
    }

    // docs:end:setup

    // docs:start:solidity_uniswap_swap_public
    /**
     * @notice Exit with funds from L2, perform swap on L1 and deposit output asset to L2 again publicly
     * @dev `msg.value` indicates fee to submit message to inbox. Currently, anyone can call this method on your behalf.
     * They could call it with 0 fee causing the sequencer to never include in the rollup.
     * In this case, you will have to cancel the message and then make the deposit later
     * @param _inputTokenPortal - The ethereum address of the input token portal
     * @param _inAmount - The amount of assets to swap (same amount as withdrawn from L2)
     * @param _outputTokenPortal - The ethereum address of the output token portal
     * @param _aztecRecipient - The aztec address to receive the output assets
     * @param _secretHashForL1ToL2Message - The hash of the secret consumable message. The hash should be 254 bits (so it can fit in a Field element)
     * @param _deadlineForL1ToL2Message - deadline for when the L1 to L2 message (to mint outpiut assets in L2) must be consumed by
     * @param _canceller - The ethereum address that can cancel the deposit
     * @param _withCaller - When true, using `msg.sender` as the caller, otherwise address(0)
     * @return The entryKey of the deposit transaction in the Inbox
     */
    function depositPublic(
        address _inputTokenPortal, // portal DAI
        uint256 _inAmount,
        address _outputTokenPortal, // portal sDAI
        bytes32 _aztecRecipient, // our aztec contract
        bytes32 _secretHashForL1ToL2Message,
        uint32 _deadlineForL1ToL2Message,
        address _canceller,
        bool _withCaller
    ) public payable returns (bytes32) {
        LocalSwapVars memory vars;

        vars.inputAsset = TokenPortal(_inputTokenPortal).underlying();
        vars.outputAsset = TokenPortal(_outputTokenPortal).underlying();

        // Withdraw the input asset from the portal
        TokenPortal(_inputTokenPortal).withdraw(address(this), _inAmount, true);
        {
            // prevent stack too deep errors
            vars.contentHash = Hash.sha256ToField(
                abi.encodeWithSignature(
                    "deposit_public(address,uint256,address,bytes32,bytes32,uint32,address,address)",
                    _inputTokenPortal,
                    _inAmount,
                    _outputTokenPortal,
                    _aztecRecipient,git 
                    _secretHashForL1ToL2Message,
                    _deadlineForL1ToL2Message,
                    _canceller,
                    _withCaller ? msg.sender : address(0)
                )
            );
        }

        // Consume the message from the outbox
        registry.getOutbox().consume(
            DataStructures.L2ToL1Msg({
                sender: DataStructures.L2Actor(l2StrategyAddress, 1),
                recipient: DataStructures.L1Actor(address(this), block.chainid),
                content: vars.contentHash
            })
        );

        // Note, safeApprove was deprecated from Oz
        vars.inputAsset.approve(address(sDAI), _inAmount);
        uint256 amountOut = sDAI.deposit(_inAmount, address(this));

        // approve the output token portal to take funds from this contract
        // Note, safeApprove was deprecated from Oz
        vars.outputAsset.approve(address(_outputTokenPortal), amountOut);
        //sDAI.approve(address(_outputTokenPortal), amountOut);

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

    // docs:end:solidity_uniswap_swap_public

    // docs:start:solidity_uniswap_swap_private
    /**
     * @notice Exit with funds from L2, perform swap on L1 and deposit output asset to L2 again privately
     * @dev `msg.value` indicates fee to submit message to inbox. Currently, anyone can call this method on your behalf.
     * They could call it with 0 fee causing the sequencer to never include in the rollup.
     * In this case, you will have to cancel the message and then make the deposit later
     * @param _inputTokenPortal - The ethereum address of the input token portal
     * @param _inAmount - The amount of assets to swap (same amount as withdrawn from L2)
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
        LocalSwapVars memory vars;

        vars.inputAsset = TokenPortal(_inputTokenPortal).underlying();
        vars.outputAsset = TokenPortal(_outputTokenPortal).underlying();

        // Withdraw the input asset from the portal
        TokenPortal(_inputTokenPortal).withdraw(address(this), _inAmount, true);
        {
            // prevent stack too deep errors
            vars.contentHash = Hash.sha256ToField(
                abi.encodeWithSignature(
                    "deposit_private(address,uint256,address,bytes32,bytes32,uint32,address,address)",
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
        }

        // Consume the message from the outbox
        registry.getOutbox().consume(
            DataStructures.L2ToL1Msg({
                sender: DataStructures.L2Actor(l2StrategyAddress, 1),
                recipient: DataStructures.L1Actor(address(this), block.chainid),
                content: vars.contentHash
            })
        );

        // Note, safeApprove was deprecated from Oz
        vars.inputAsset.approve(address(sDAI), _inAmount);
        uint256 amountOut = sDAI.deposit(_inAmount, address(this));

        // approve the output token portal to take funds from this contract
        // Note, safeApprove was deprecated from Oz
        vars.outputAsset.approve(address(_outputTokenPortal), amountOut);

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
}
