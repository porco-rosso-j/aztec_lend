import {
	AccountWallet,
	AztecAddress,
	DebugLogger,
	EthAddress,
	CompleteAddress,
	Fr,
	PXE,
	TxStatus,
	computeAuthWitMessageHash,
	createPXEClient,
	getSandboxAccountsWallets,
	sleep,
} from "@aztec/aztec.js";
import { deployL1Contract } from "@aztec/ethereum";
// import aztecLendPortalArtifact from "../../../l1-contracts/artifacts/contracts/AztecLendPortal.sol/AztecLendPortal.json";
import aztecLendPortalArtifact from "./sources/AztecLendPortal.json";
import { AztecLendContract } from "./utils/AztecLend";
import {
	OutboxAbi,
	PortalERC20Abi,
	PortalERC20Bytecode,
	TokenPortalAbi,
	TokenPortalBytecode,
} from "@aztec/l1-artifacts";
import {
	Chain,
	HttpTransport,
	PublicClient,
	getContract,
	parseEther,
	Hex,
	HDAccount,
	createWalletClient,
	createPublicClient,
	http,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
	PXE_URL,
	RPC_URL,
	userAztecAddr,
	userETHAddr,
	l2TokenAddress,
	l2BridgeAddress,
	tokenPortalAddresses,
	TOKEN_ADDRESSES,
	userWallet,
	aztecLendPortalAddr,
	aztecLendL2Addr,
} from "./utils/constants";
import { localAnvil, MNEMONIC } from "./utils/setup/fixtures";
import { CrossChainTestHarness } from "./utils/setup/cross-chain";
import { getEntryKeyFromEvent } from "./utils/event";
import {
	TokenContract,
	TokenBridgeContract,
	// @ts-ignore
} from "@aztec/noir-contracts/types";
import { init } from "./utils/setup/config";

export async function depositDAI(_amount: number) {
	const amount = new Fr(BigInt(parseEther(_amount.toString())));
	const { wallet, walletClient, publicClient, pxeClient } = await init();

	const dai = getContract({
		address: TOKEN_ADDRESSES.DAI as Hex,
		abi: PortalERC20Abi,
		walletClient,
		publicClient,
	});

	const sdai = getContract({
		address: TOKEN_ADDRESSES.SDAI as Hex,
		abi: PortalERC20Abi,
		walletClient,
		publicClient,
	});

	const daiTokenPortal = getContract({
		address: tokenPortalAddresses.DAI as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const sDAITokenPortal = getContract({
		address: tokenPortalAddresses.SDAI as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const l2DAI = await TokenContract.at(l2TokenAddress[0], wallet);
	const l2SDAI = await TokenContract.at(l2TokenAddress[1], wallet);

	const daiBridgeTokenContract = await TokenBridgeContract.at(
		l2BridgeAddress[0],
		wallet
	);

	const sDAIBridgeTokenContract = await TokenBridgeContract.at(
		l2BridgeAddress[1],
		wallet
	);

	const l1ContractAddresses = (await pxeClient.getNodeInfo())
		.l1ContractAddresses;
	const outbox = getContract({
		address: l1ContractAddresses.outboxAddress.toString(),
		abi: OutboxAbi,
		publicClient,
	});

	const daiCrossChain = new CrossChainTestHarness(
		pxeClient,
		l2DAI,
		daiBridgeTokenContract,
		userETHAddr,
		tokenPortalAddresses.DAI,
		daiTokenPortal,
		dai, // underlyingERC20
		publicClient,
		walletClient,
		outbox,
		userAztecAddr
	);

	console.log("daiCrossChain: ", daiCrossChain);

	const sdaiCrossChain = new CrossChainTestHarness(
		pxeClient,
		l2SDAI,
		sDAIBridgeTokenContract,
		userETHAddr,
		tokenPortalAddresses.SDAI,
		sDAITokenPortal,
		sdai, // underlyingERC20
		publicClient,
		walletClient,
		outbox,
		userAztecAddr
	);

	console.log("sdaiCrossChain: ", sdaiCrossChain);

	const aztecLendPortal = getContract({
		address: aztecLendPortalAddr as Hex,
		abi: aztecLendPortalArtifact.abi,
		walletClient,
		publicClient,
	});

	const aztecLendL2Contract = await AztecLendContract.at(
		aztecLendL2Addr,
		wallet
	);

	console.log("aztecLendL2Contract: ", aztecLendL2Contract);
	console.log(
		"nonce_for_burn_approval: ",
		await aztecLendL2Contract.methods.nonce_for_burn_approval().view()
	);

	const nonceForDAIUnshieldApproval = new Fr(18n);

	const unshieldToAztecLendMessageHash = await aztecLendL2Contract.methods
		.compute_authwith_msg_hash(
			aztecLendL2Contract.address,
			daiCrossChain.l2Token.address,
			new Fr(
				0x25048e8c1b7dea68053d597ac2d920637c99523651edfb123d0632da785970d0n
			).toBuffer(),
			//new Fr(wallet.getAddress()),
			amount,
			nonceForDAIUnshieldApproval
		)
		.view();

	console.log(
		"unshieldToAztecLendMessageHash: ",
		unshieldToAztecLendMessageHash
	);
	console.log("wallet addr: ", wallet.getAddress().toString());

	await wallet.createAuthWitness(new Fr(unshieldToAztecLendMessageHash));

	const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
		await sdaiCrossChain.generateClaimSecret();

	const [secretForRedeemingSDAI, secretHashForRedeemingSDAI] =
		await sdaiCrossChain.generateClaimSecret();

	const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1);

	const withdrawReceipt = await aztecLendL2Contract.methods
		.deposit_private(
			daiCrossChain.l2Token.address,
			daiCrossChain.l2Bridge.address,
			amount,
			sdaiCrossChain.l2Bridge.address,
			nonceForDAIUnshieldApproval,
			secretHashForRedeemingSDAI,
			secretHashForSDAIDeposit,
			deadlineForSDAIDeposit,
			userETHAddr,
			userETHAddr
		)
		.send()
		.wait();

	console.log("status: ", withdrawReceipt);

	console.log(
		"balance: ",
		await daiCrossChain.getL2PrivateBalanceOf(userAztecAddr)
	);

	const sdaiL1BalanceOfPortalBeforeDeposit =
		await sdaiCrossChain.getL1BalanceOf(sdaiCrossChain.tokenPortalAddress);

	const depositArgs = [
		daiCrossChain.tokenPortalAddress.toString(),
		amount,
		sdaiCrossChain.tokenPortalAddress.toString(),
		secretHashForRedeemingSDAI.toString(true),
		secretHashForSDAIDeposit.toString(true),
		deadlineForSDAIDeposit,
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

	const sdaiL1BalanceOfPortalAfter = await sdaiCrossChain.getL1BalanceOf(
		sdaiCrossChain.tokenPortalAddress
	);

	console.log("sdaiL1BalanceOfPortalAfter: ", sdaiL1BalanceOfPortalAfter);

	console.log("4");

	const sdaiAmountToBridge = BigInt(
		sdaiL1BalanceOfPortalAfter - sdaiL1BalanceOfPortalBeforeDeposit
	);

	console.log("sdaiAmountToBridge: ", sdaiAmountToBridge);

	// Wait for the archiver to process the message
	await sleep(5000);
	// send a transfer tx to force through rollup with the message included
	// await daiCrossChain.mintTokensPublicOnL2(0n);
	await daiCrossChain.mintTokensPublicOnL2(0n);

	console.log("5");

	const entryKey = await getEntryKeyFromEvent(
		txhash,
		l1ContractAddresses.inboxAddress.toString()
	);

	console.log("6");
	console.log("entryKey: ", entryKey);

	// 6. claim sdai on L2
	await sdaiCrossChain.consumeMessageOnAztecAndMintSecretly(
		secretHashForRedeemingSDAI,
		sdaiAmountToBridge,
		Fr.fromString(entryKey as string),
		secretForSDAIDeposit
	);

	await sleep(5000);
	await daiCrossChain.mintTokensPublicOnL2(0n);

	console.log("sdai amt: ", sdaiAmountToBridge);
	await sdaiCrossChain.redeemShieldPrivatelyOnL2(
		sdaiAmountToBridge,
		secretForRedeemingSDAI
	);

	console.log("done!");
}

export async function claimSDAI(amount: number) {}
