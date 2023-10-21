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
import aztecLendPortalArtifact from "../../../l1-contracts/artifacts/contracts/AztecLendPortal.sol/AztecLendPortal.json";
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
	tokenPortalAddr,
	tokenPortalAddresses,
	TOKEN_ADDRESSES,
	userWallet,
} from "./utils/constants";
import { localAnvil, MNEMONIC } from "./utils/setup/fixtures";
import { CrossChainTestHarness } from "./utils/setup/cross-chain";

import {
	TokenContract,
	TokenBridgeContract,
	// @ts-ignore
} from "@aztec/noir-contracts/types";

export async function depositDAI(amount: number) {
	console.log("1");
	const hdAccount = mnemonicToAccount(MNEMONIC);

	console.log("2");
	const pxeClient = await createPXEClient(PXE_URL);
	//const wallets = await getSandboxAccountsWallets(pxeClient);

	console.log("3");

	const walletClient: any = createWalletClient<HttpTransport, Chain, HDAccount>(
		{
			account: hdAccount,
			chain: localAnvil,
			transport: http(RPC_URL),
		}
	);

	console.log("4");
	const publicClient: any = createPublicClient({
		chain: localAnvil,
		transport: http(RPC_URL),
	});

	// token/contract instances

	console.log("5");

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
		address: tokenPortalAddr as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const sDAITokenPortal = getContract({
		address: tokenPortalAddr as Hex,
		abi: TokenPortalAbi,
		walletClient,
		publicClient,
	});

	const daiCompleteAddr = new CompleteAddress(
		l2TokenAddress[0].aztecAddr,
		l2TokenAddress[0].pubkey,
		l2TokenAddress[0].partialAddr
	);
	const l2DAI = new TokenContract(daiCompleteAddr, await userWallet());

	const sDAICompleteAddr = new CompleteAddress(
		l2TokenAddress[1].aztecAddr,
		l2TokenAddress[1].pubkey,
		l2TokenAddress[1].partialAddr
	);
	const l2SDAI = new TokenContract(sDAICompleteAddr, await userWallet());

	const daiBridgeCompleteAddr = new CompleteAddress(
		l2BridgeAddress[0].aztecAddr,
		l2BridgeAddress[0].pubkey,
		l2BridgeAddress[0].partialAddr
	);
	const daiBridgeTokenContract = new TokenBridgeContract(
		daiBridgeCompleteAddr,
		await userWallet()
	);

	const sDAIBridgeCompleteAddr = new CompleteAddress(
		l2BridgeAddress[1].aztecAddr,
		l2BridgeAddress[1].pubkey,
		l2BridgeAddress[1].partialAddr
	);
	const sDAIBridgeTokenContract = new TokenBridgeContract(
		sDAIBridgeCompleteAddr,
		await userWallet()
	);

	const l1ContractAddresses = (await pxeClient.getNodeInfo())
		.l1ContractAddresses;
	const outbox = getContract({
		address: l1ContractAddresses.outboxAddress.toString(),
		abi: OutboxAbi,
		//publicClient,
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

	// prepare everything
	// instantiate Crosschain harness
	// paste what aztec_lend_l1_l2 does in test
	// done

	console.log("sdaiCrossChain: ", sdaiCrossChain);

	const daiL1BeforeBalance = await daiCrossChain.getL1BalanceOf(userETHAddr);
	console.log("daiL1BeforeBalance: ", daiL1BeforeBalance);

	const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1); // max uint32
}

export async function claimSDAI(amount: number) {}
