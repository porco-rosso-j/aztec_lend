import { Fr, sleep } from "@aztec/aztec.js";
import aztecLendPortalArtifact from "./artifacts/AztecLendPortal.json";
import { AztecLendContract } from "./artifacts/AztecLend";
import { OutboxAbi, PortalERC20Abi, TokenPortalAbi } from "@aztec/l1-artifacts";
import { getContract, parseEther, Hex } from "viem";
import {
	userAztecAddr,
	userETHAddr,
	aztecLendPortalAddr,
	aztecLendL2Addr,
} from "./utils/constants";
import { CrossChainHarness } from "./utils/cross-chain";
import { getEntryKeyFromEvent } from "./utils/event";
import {
	TokenContract,
	TokenBridgeContract,
	// @ts-ignore
} from "@aztec/noir-contracts/types";
import { init } from "./utils/init";

export class TokenConfig {
    public depositToken: string;
    public depositTokenPortal: string;
    public depositTokenL2Address: string;
    public depositTokenPortalL2Address: string;

    public redeemToken: string;
    public redeemTokenPortal: string;
    public redeemTokenL2Address: string;
    public redeemTokenPortalL2Address: string;
}

export async function depositERC20(config: TokenConfig, _amount: number, decimals: number = 18) {
	const amount = new Fr(BigInt(parseEther(_amount.toString()) * BigInt(decimals) / BigInt(18)));
	const { wallet, walletClient, publicClient, pxeClient } = await init();

	/// L1 Contracts
	const token = getContract({
		address: config.depositToken as Hex,
		abi: PortalERC20Abi,
		walletClient,
		publicClient,
	});

	const redeemToken = getContract({
		address: config.redeemToken as Hex,
		abi: PortalERC20Abi,
		walletClient,
		publicClient,
	});

	const tokenPortal = getContract({
		address: config.depositTokenPortal as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const redeemTokenPortal = getContract({
		address: config.redeemTokenPortal as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const l1ContractAddresses = (await pxeClient.getNodeInfo())
		.l1ContractAddresses;
	const outbox = getContract({
		address: l1ContractAddresses.outboxAddress.toString(),
		abi: OutboxAbi,
		publicClient,
	});

	const aztecLendPortal = getContract({
		address: aztecLendPortalAddr as Hex,
		abi: aztecLendPortalArtifact.abi,
		walletClient,
		publicClient,
	});

	/// L2 Contracts

	const aztecLendL2Contract = await AztecLendContract.at(
		aztecLendL2Addr,
		wallet
	);

	const l2Token = await TokenContract.at(config.depositTokenL2Address, wallet);
	const l2RedeemToken = await TokenContract.at(config.redeemTokenL2Address, wallet);

	const tokenBridgeContract = await TokenBridgeContract.at(
		config.depositTokenPortalL2Address,
		wallet
	);

	const redeemTokenBridgeContract = await TokenBridgeContract.at(
		config.redeemTokenPortalL2Address,
		wallet
	);

	// set up cross-chain harness classes

	const depositTokenCrossChain = new CrossChainHarness(
		pxeClient,
		l2Token,
		tokenBridgeContract,
		userETHAddr,
		config.depositTokenPortal,
		tokenPortal,
		token, // underlyingERC20
		publicClient,
		walletClient,
		outbox,
		userAztecAddr
	);

	const redeemTokenCrossChain = new CrossChainHarness(
		pxeClient,
		l2RedeemToken,
		redeemTokenBridgeContract,
		userETHAddr,
		config.redeemTokenPortal,
		redeemTokenPortal,
		redeemToken, // underlyingERC20
		publicClient,
		walletClient,
		outbox,
		userAztecAddr
	);

	if (!localStorage[redeemToken.address]) localStorage[redeemToken.address] = 1;
	const nonceForTokenUnshieldApproval = new Fr(localStorage[redeemToken.address]++);

	const unshieldToAztecLendMessageHash = await aztecLendL2Contract.methods
		.compute_authwith_msg_hash(
			aztecLendL2Contract.address,
			depositTokenCrossChain.l2Token.address,
			new Fr(
				0x25048e8c1b7dea68053d597ac2d920637c99523651edfb123d0632da785970d0n
			).toBuffer(),
			//new Fr(wallet.getAddress()),
			amount,
			nonceForTokenUnshieldApproval
		)
		.view();

	console.log(
		"unshieldToAztecLendMessageHash: ",
		unshieldToAztecLendMessageHash
	);
	console.log("wallet addr: ", wallet.getAddress().toString());

	await wallet.createAuthWitness(new Fr(unshieldToAztecLendMessageHash));

	const [secretForRedeemTokenDeposit, secretHashForRedeemTokenDeposit] =
		await redeemTokenCrossChain.generateClaimSecret();

	const [secretForRedeeming, secretHashForRedeeming] =
		await redeemTokenCrossChain.generateClaimSecret();

	const deadlineForRedeemTokenDeposit = BigInt(2 ** 32 - 1);

	const withdrawReceipt = await aztecLendL2Contract.methods
		.deposit_private(
			depositTokenCrossChain.l2Token.address,
			depositTokenCrossChain.l2Bridge.address,
			amount,
			redeemTokenCrossChain.l2Bridge.address,
			nonceForTokenUnshieldApproval,
			secretHashForRedeeming,
			secretHashForRedeemTokenDeposit,
			deadlineForRedeemTokenDeposit,
			userETHAddr,
			userETHAddr
		)
		.send()
		.wait();

	console.log("status: ", withdrawReceipt);

	console.log(
		"balance: ",
		await depositTokenCrossChain.getL2PrivateBalanceOf(userAztecAddr)
	);

	const redeemTokenL1BalanceOfPortalBeforeDeposit =
		await redeemTokenCrossChain.getL1BalanceOf(redeemTokenCrossChain.tokenPortalAddress);

	const depositArgs = [
		depositTokenCrossChain.tokenPortalAddress.toString(),
		amount,
		redeemTokenCrossChain.tokenPortalAddress.toString(),
		secretHashForRedeeming.toString(true),
		secretHashForRedeemTokenDeposit.toString(true),
		deadlineForRedeemTokenDeposit,
		userETHAddr.toString(),
		true,
	] as const;

	console.log("1");

	// this should also insert a message into the inbox.
	// @ts-ignore
	const txhash = await aztecLendPortal.write.depositPrivate(
		depositArgs,
		{} as any
	);

	console.log("txhash: ", txhash);

	await sleep(5000);

	console.log("3");

	const redeemTokenL1BalanceOfPortalAfter = await redeemTokenCrossChain.getL1BalanceOf(
		redeemTokenCrossChain.tokenPortalAddress
	);

	console.log("redeemTokenL1BalanceOfPortalAfter: ", redeemTokenL1BalanceOfPortalAfter);

	console.log("4");

	const redeemTokenAmountToBridge = BigInt(
		redeemTokenL1BalanceOfPortalAfter - redeemTokenL1BalanceOfPortalBeforeDeposit
	);

	console.log("redeemTokenAmountToBridge: ", redeemTokenAmountToBridge);

	// Wait for the archiver to process the message
	await sleep(5000);
	// send a transfer tx to force through rollup with the message included
	await depositTokenCrossChain.mintTokensPublicOnL2(0n);

	console.log("5");

	const entryKey = await getEntryKeyFromEvent(
		txhash,
		l1ContractAddresses.inboxAddress.toString()
	);

	console.log("6");
	console.log("entryKey: ", entryKey);

	await redeemTokenCrossChain.consumeMessageOnAztecAndMintSecretly(
		secretHashForRedeeming,
		redeemTokenAmountToBridge,
		Fr.fromString(entryKey as string),
		secretForRedeemTokenDeposit
	);

	await sleep(5000);
	await depositTokenCrossChain.mintTokensPublicOnL2(0n);

	console.log("redeem amt: ", redeemTokenAmountToBridge);
	await redeemTokenCrossChain.redeemShieldPrivatelyOnL2(
		redeemTokenAmountToBridge,
		secretForRedeeming
	);

	console.log("done!");
}