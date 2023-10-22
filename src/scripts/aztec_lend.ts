import {
	AccountWallet,
	AztecAddress,
	DebugLogger,
	EthAddress,
	Fr,
	PXE,
	computeAuthWitMessageHash,
	sleep,
} from "@aztec/aztec.js";
import { deployL1Contract } from "@aztec/ethereum";
import aztecLendPortalArtifact from "../../l1-contracts/artifacts/contracts/AztecLendPortal.sol/AztecLendPortal.json" assert { type: "json" };
import { AztecLendContract } from "../test/fixtures/AztecLend.js";
import {
	Chain,
	HttpTransport,
	PublicClient,
	getContract,
	parseEther,
	Hex,
} from "viem";
// import { CrossChainTestHarness } from "./cross-chain.js";
// import { fundDAI } from "./helpers/fundERC20.js";
// import { CrossChainTestHarness } from "../test/shared/cross_chain_test_harness.js";
import { CrossChainTestHarness } from "./cross-chain.js";
import { fundDAI } from "../test/helpers/fundERC20.js";

const TIMEOUT = 250_000;

/** Objects to be returned by the azteclend setup function */
export type AztecLendSetupContext = {
	/** The Private eXecution Environment (PXE). */
	pxe: PXE;
	/** Logger instance named as the current test. */
	logger: DebugLogger;
	/** Viem Public client instance. */
	publicClient: PublicClient<HttpTransport, Chain>;
	/** Viem Wallet Client instance. */
	walletClient: any;
	/** The owner wallet. */
	ownerWallet: AccountWallet;
	/** The sponsor wallet. */
	sponsorWallet: AccountWallet;
};

const DAI_ADDRESS: EthAddress = EthAddress.fromString(
	"0x6B175474E89094C44Da98b954EedeAC495271d0F"
);
const SDAI_ADDRESS: EthAddress = EthAddress.fromString(
	"0x83F20F44975D03b1b09e64809B757c47f942BEeA"
);

export async function aztecLendL1L2TestSuite(
	setup: () => Promise<AztecLendSetupContext>,
	//setup: () => Promise<any>,
	expectedForkBlockNumber: number
) {
	let pxe: PXE;
	let logger: DebugLogger;

	let walletClient: any;

	let ownerWallet: AccountWallet;
	let ownerAddress: AztecAddress;
	let ownerEthAddress: EthAddress;

	let sponsorWallet: AccountWallet;
	let sponsorAddress: AztecAddress;

	let daiCrossChainHarness: CrossChainTestHarness;
	let sDAICrossChainHarness: CrossChainTestHarness;

	let aztecLendPortal: any;
	let aztecLendPortalAddress: EthAddress;
	let aztecLendL2Contract: AztecLendContract;

	const daiAmountToBridge = parseEther("1000");
	const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1); // max uint32

	let registryAddress: EthAddress;
	let inboxAddress: EthAddress;

	let publicClient: PublicClient<HttpTransport, Chain>;
	({ pxe, logger, publicClient, walletClient, ownerWallet, sponsorWallet } =
		await setup());

	if (Number(await publicClient.getBlockNumber()) < expectedForkBlockNumber) {
		throw new Error(
			"This test must be run on a fork of mainnet with the expected fork block"
		);
	}

	console.log("ownerWallet: ", ownerWallet);
	ownerAddress = ownerWallet.getAddress();
	console.log("ownerAddress Aztec: ", ownerAddress.toString());
	sponsorAddress = sponsorWallet.getAddress();
	ownerEthAddress = EthAddress.fromString(
		(await walletClient.getAddresses())[0]
	);

	console.log("ownerEthAddress eth: ", ownerEthAddress.toString());

	// logger("Deploying DAI Portal, initializing and deploying l2 contract...");
	daiCrossChainHarness = await CrossChainTestHarness.new(
		pxe,
		publicClient,
		walletClient,
		ownerWallet,
		logger,
		DAI_ADDRESS
	);

	console.log(
		"dai l2 token addr: ",
		daiCrossChainHarness.l2Token.address.toString()
	);

	console.log(
		"dai l2 bridge addr: ",
		daiCrossChainHarness.l2Bridge.address.toString()
	);
	console.log(
		"dai l2 portal addr: ",
		daiCrossChainHarness.tokenPortal.address.toString()
	);

	// logger("Deploying sDAI Portal, initializing and deploying l2 contract...");
	sDAICrossChainHarness = await CrossChainTestHarness.new(
		pxe,
		publicClient,
		walletClient,
		ownerWallet,
		logger,
		SDAI_ADDRESS
	);

	console.log(
		"sdai l2 token addr: ",
		sDAICrossChainHarness.l2Token.address.toString()
	);

	console.log(
		"sdai l2 bridge addr: ",
		sDAICrossChainHarness.l2Bridge.address.toString()
	);

	console.log(
		"sdai l2 portal addr: ",
		sDAICrossChainHarness.tokenPortal.address.toString()
	);

	//daiCrossChainHarness.getL2PublicBalanceOf;

	// logger("Deploy SavingsDAI portal on L1 and L2...");
	aztecLendPortalAddress = await deployL1Contract(
		walletClient,
		publicClient,
		aztecLendPortalArtifact.abi,
		aztecLendPortalArtifact.bytecode as Hex
	);

	console.log("aztec lend portal addr: ", aztecLendPortalAddress.toString());

	aztecLendPortal = getContract({
		address: aztecLendPortalAddress.toString(),
		abi: aztecLendPortalArtifact.abi,
		walletClient,
		publicClient,
	});
	// deploy l2 azteclend contract and attach to portal
	aztecLendL2Contract = await AztecLendContract.deploy(ownerWallet)
		.send({ portalContract: aztecLendPortalAddress })
		.deployed();

	({ registryAddress, inboxAddress } = (
		await pxe.getNodeInfo()
	).l1ContractAddresses);

	console.log("aztecLendL2Contract: ", aztecLendL2Contract.address.toString());

	await aztecLendPortal.write.initialize(
		[registryAddress.toString(), aztecLendL2Contract.address.toString()],
		{} as any
	);

	// logger("Getting some dai");
	await fundDAI(ownerEthAddress.toString());

	// 1. Approve and deposit dai to the portal and move to L2
	const [secretForMintingDai, secretHashForMintingDai] =
		await daiCrossChainHarness.generateClaimSecret();

	const [secretForRedeemingDai, secretHashForRedeemingDai] =
		await daiCrossChainHarness.generateClaimSecret();

	const messageKey = await daiCrossChainHarness.sendTokensToPortalPrivate(
		secretHashForRedeemingDai,
		daiAmountToBridge,
		secretHashForMintingDai
	);

	// Wait for the archiver to process the message
	await sleep(5000);

	// Perform an unrelated transaction on L2 to progress the rollup. Here we mint public tokens.
	await daiCrossChainHarness.mintTokensPublicOnL2(0n);

	// 2. Claim WETH on L2
	// logger("Minting dai on L2");
	await daiCrossChainHarness.consumeMessageOnAztecAndMintSecretly(
		secretHashForRedeemingDai,
		daiAmountToBridge,
		messageKey,
		secretForMintingDai
	);

	await daiCrossChainHarness.redeemShieldPrivatelyOnL2(
		daiAmountToBridge,
		secretForRedeemingDai
	);
	console.log("done");
}
// retunr smth
