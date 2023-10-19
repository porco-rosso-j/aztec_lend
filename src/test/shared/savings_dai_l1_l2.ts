import {
	AccountWallet,
	AztecAddress,
	DebugLogger,
	EthAddress,
	Fr,
	PXE,
	TxStatus,
	computeAuthWitMessageHash,
	sleep,
} from "@aztec/aztec.js";
import { deployL1Contract } from "@aztec/ethereum";
import savingsDAIPortalArtifact from "../../../l1-contracts/artifacts/contracts/spark/SavingsDAIPortal.sol/SavingsDaiPortal.json";
// import { SavingsDAIContract } from '../shared/savings_dai.js'
import { SavingsDAIContract } from "../fixtures/SavingsDAI.js";
import { jest } from "@jest/globals";
import {
	Chain,
	HttpTransport,
	PublicClient,
	getContract,
	parseEther,
	Hex,
} from "viem";
import { CrossChainTestHarness } from "./cross_chain_test_harness.js";
import { fundDAI } from "../utils/fundERC20.js";
// PSA: This tests works on forked mainnet. There is a dump of the data in `dumpedState` such that we
// don't need to burn through RPC requests.
// To generate a new dump, use the `dumpChainState` cheatcode.
// To start an actual fork, use the command:
// anvil --fork-url https://mainnet.infura.io/v3/9928b52099854248b3a096be07a6b23c --fork-block-number 17514288 --chain-id 31337
// For CI, this is configured in `run_tests.sh` and `docker-compose.yml`

// 1: fund DAI to wallet 1
// 2: generate SavingsDAIContract with aztec-cli
// 3: update crosschaintestHarness in case

// docs:start:uniswap_l1_l2_test_setup_const
const TIMEOUT = 125_000;

/** Objects to be returned by the uniswap setup function */
export type SavingsDAISetupContext = {
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
// docs:end:uniswap_l1_l2_test_setup_const

export const savingsDAIL1L2TestSuite = (
	setup: () => Promise<SavingsDAISetupContext>,
	cleanup: () => Promise<void>,
	expectedForkBlockNumber: number
) => {
	// docs:start:uniswap_l1_l2_test_beforeAll
	describe("savings_dai_on_l1_from_l2", () => {
		jest.setTimeout(TIMEOUT);

		//const WETH_ADDRESS: EthAddress = EthAddress.fromString('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
		const DAI_ADDRESS: EthAddress = EthAddress.fromString(
			"0x6B175474E89094C44Da98b954EedeAC495271d0F"
		);
		const SDAI_ADDRESS: EthAddress = EthAddress.fromString(
			"0x83F20F44975D03b1b09e64809B757c47f942BEeA"
		);

		let pxe: PXE;
		let logger: DebugLogger;

		let walletClient: any;

		let ownerWallet: AccountWallet;
		let ownerAddress: AztecAddress;
		let ownerEthAddress: EthAddress;
		// does transactions on behalf of owner on Aztec:
		let sponsorWallet: AccountWallet;
		let sponsorAddress: AztecAddress;

		let daiCrossChainHarness: CrossChainTestHarness;
		let sDAICrossChainHarness: CrossChainTestHarness;

		let savingsDAIPortal: any;
		let savingsDAIPortalAddress: EthAddress;
		let savingsDAIL2Contract: SavingsDAIContract;

		const daiAmountToBridge = parseEther("1000");
		const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1); // max uint32

		beforeAll(async () => {
			let publicClient: PublicClient<HttpTransport, Chain>;
			({ pxe, logger, publicClient, walletClient, ownerWallet, sponsorWallet } =
				await setup());

			if (
				Number(await publicClient.getBlockNumber()) < expectedForkBlockNumber
			) {
				throw new Error(
					"This test must be run on a fork of mainnet with the expected fork block"
				);
			}

			ownerAddress = ownerWallet.getAddress();
			sponsorAddress = sponsorWallet.getAddress();
			ownerEthAddress = EthAddress.fromString(
				(await walletClient.getAddresses())[0]
			);

			logger("Deploying DAI Portal, initializing and deploying l2 contract...");
			daiCrossChainHarness = await CrossChainTestHarness.new(
				pxe,
				publicClient,
				walletClient,
				ownerWallet,
				logger,
				DAI_ADDRESS
			);

			logger(
				"Deploying sDAI Portal, initializing and deploying l2 contract..."
			);
			sDAICrossChainHarness = await CrossChainTestHarness.new(
				pxe,
				publicClient,
				walletClient,
				ownerWallet,
				logger,
				SDAI_ADDRESS
			);

			logger("Deploy SavingsDAI portal on L1 and L2...");
			savingsDAIPortalAddress = await deployL1Contract(
				walletClient,
				publicClient,
				savingsDAIPortalArtifact.abi,
				savingsDAIPortalArtifact.bytecode as Hex
			);

			savingsDAIPortal = getContract({
				address: savingsDAIPortalAddress.toString(),
				abi: savingsDAIPortalArtifact.abi,
				walletClient,
				publicClient,
			});
			// deploy l2 uniswap contract and attach to portal
			savingsDAIL2Contract = await SavingsDAIContract.deploy(ownerWallet)
				.send({ portalContract: savingsDAIPortalAddress })
				.deployed();

			console.log(
				"savingsDAIL2Contract: ",
				savingsDAIL2Contract.address.toString()
			);

			const { registryAddress, outboxAddress } = (await pxe.getNodeInfo()).l1ContractAddresses;

			console.log("registryAddress: ", registryAddress.toString());
			console.log("outboxAddress: ", outboxAddress.toString());

			await savingsDAIPortal.write.initialize(
				[registryAddress.toString(), savingsDAIL2Contract.address.toString()],
				{} as any
			);

			logger("Getting some dai");
			await fundDAI(ownerEthAddress.toString());
		});

		// beforeEach(async () => {
		//   // Give me some WETH so I can deposit to L2 and do the deposit...
		//   logger('Getting some dai');
		//   // await walletClient.sendTransaction({ to: DAI_ADDRESS.toString(), value: parseEther('1') });
		// });
		// // docs:end:uniswap_l1_l2_test_beforeAll

		afterAll(async () => {
			await cleanup();
		});

		// docs:start:uniswap_private
		it.skip("should deposit on L1 from L2 funds privately", async () => {
			console.log("1");

			const daiL1BeforeBalance = await daiCrossChainHarness.getL1BalanceOf(
				ownerEthAddress
			);

			console.log("2");

			// 1. Approve and deposit dai to the portal and move to L2
			const [secretForMintingDai, secretHashForMintingDai] =
				await daiCrossChainHarness.generateClaimSecret();

			console.log("3");

			const [secretForRedeemingDai, secretHashForRedeemingDai] =
				await daiCrossChainHarness.generateClaimSecret();

			console.log("4");
			const messageKey = await daiCrossChainHarness.sendTokensToPortalPrivate(
				secretHashForRedeemingDai,
				daiAmountToBridge,
				secretHashForMintingDai
			);

			console.log("5");
			// funds transferred from owner to token portal
			expect(await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
				daiL1BeforeBalance - daiAmountToBridge
			);

			console.log("6");
			expect(
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				)
			).toBe(daiAmountToBridge);

			// Wait for the archiver to process the message
			await sleep(5000);

			// Perform an unrelated transaction on L2 to progress the rollup. Here we mint public tokens.
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			console.log("7");

			// 2. Claim WETH on L2
			logger("Minting dai on L2");
			await daiCrossChainHarness.consumeMessageOnAztecAndMintSecretly(
				secretHashForRedeemingDai,
				daiAmountToBridge,
				messageKey,
				secretForMintingDai
			);

			console.log("8");

			await daiCrossChainHarness.redeemShieldPrivatelyOnL2(
				daiAmountToBridge,
				secretForRedeemingDai
			);
			console.log("9");

			await daiCrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				daiAmountToBridge
			);

			console.log("10");
			// Store balances
			const daiL2BalanceBeforeDeposit =
				await daiCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);

			console.log("daiL2BalanceBeforeDeposit: ", daiL2BalanceBeforeDeposit);
			console.log("11");

			const sdaiL2BalanceBeforeDeposit =
				await sDAICrossChainHarness.getL2PrivateBalanceOf(ownerAddress);

			console.log("sdaiL2BalanceBeforeDeposit: ", sdaiL2BalanceBeforeDeposit);
			console.log("12");

			// before deposit - check nonce_for_burn_approval stored on azteclend
			// (which is used by azteclend to approve the bridge to burn funds on its behalf to exit to L1)
			const nonceForBurnApprovalBeforeDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();

			console.log("13");
			// 3. Owner gives azteclend approval to unshield funds to self on its behalf
			logger("Approving azteclend to unshield funds to self on my behalf");
			const nonceForDAIUnshieldApproval = new Fr(1n);
			const unshieldToUniswapMessageHash = await computeAuthWitMessageHash(
				savingsDAIL2Contract.address,
				daiCrossChainHarness.l2Token.methods
					.unshield(
						ownerAddress,
						savingsDAIL2Contract.address,
						daiAmountToBridge,
						nonceForDAIUnshieldApproval
					)
					.request()
			);
			console.log("14");
			await ownerWallet.createAuthWitness(
				Fr.fromBuffer(unshieldToUniswapMessageHash)
			);

			console.log("15");

			// 4. Deposit on L1 - sends L2 to L1 message to withdraw DAI to L1 and another message to deposit assets.
			logger(
				"Withdrawing dai to L1 and sending message to deposit to sdai contract"
			);
			const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
				await sDAICrossChainHarness.generateClaimSecret();
			console.log("16");
			const [secretForRedeemingSDAI, secretHashForRedeemingSDAI] =
				await sDAICrossChainHarness.generateClaimSecret();

			console.log("17");
			const withdrawReceipt = await savingsDAIL2Contract.methods
				.deposit_private(
					daiCrossChainHarness.l2Token.address,
					daiCrossChainHarness.l2Bridge.address,
					daiAmountToBridge,
					sDAICrossChainHarness.l2Bridge.address,
					nonceForDAIUnshieldApproval,
					secretHashForRedeemingSDAI,
					secretHashForSDAIDeposit,
					deadlineForSDAIDeposit,
					ownerEthAddress,
					ownerEthAddress
				)
				.send()
				.wait();
			expect(withdrawReceipt.status).toBe(TxStatus.MINED);
			console.log("18");
			// ensure that user's funds were burnt
			await daiCrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				daiL2BalanceBeforeDeposit - daiAmountToBridge
			);
			console.log("19");
			// ensure that uniswap contract didn't eat the funds.
			await daiCrossChainHarness.expectPublicBalanceOnL2(
				savingsDAIL2Contract.address,
				0n
			);

			console.log("20");
			// check burn approval nonce incremented:
			const nonceForBurnApprovalAfterDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();
			expect(nonceForBurnApprovalAfterDeposit).toBe(
				nonceForBurnApprovalBeforeDeposit + 1n
			);

			console.log("21");
			console.log(
				"nonceForBurnApprovalAfterDeposit: ",
				nonceForBurnApprovalAfterDeposit
			);

			// 5. Consume L2 to L1 message by calling savingsDAIPortal.deposit_private()
			logger("Execute withdraw and deposit on the savingsDAIPortal!");
			const sdaiL1BalanceOfPortalBeforeDeposit =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

			console.log(
				"sdaiL1BalanceOfPortalBeforeDeposit: ",
				sdaiL1BalanceOfPortalBeforeDeposit
			);

			console.log(
				"dai balance on portal: ",
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				)
			);

			console.log("22");
			const depositArgs = [
				daiCrossChainHarness.tokenPortalAddress.toString(),
				daiAmountToBridge,
				sDAICrossChainHarness.tokenPortalAddress.toString(),
				secretHashForRedeemingSDAI.toString(true),
				secretHashForSDAIDeposit.toString(true),
				deadlineForSDAIDeposit,
				ownerEthAddress.toString(),
				true,
			] as const;

			console.log("22.5");

			const { result: depositDaiMessageKeyHex } =
				await savingsDAIPortal.simulate.depositPrivate(depositArgs, {
					account: ownerEthAddress.toString(),
				} as any);

			console.log("23");
			// this should also insert a message into the inbox.
			await savingsDAIPortal.write.depositPrivate(depositArgs, {} as any);
			const depositDaiMessageKey = Fr.fromString(depositDaiMessageKeyHex);

			console.log("24");

			// dai was swapped to sdai and send to portal
			const sdaiL1BalanceOfPortalAfter =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

			console.log("25");
			expect(sdaiL1BalanceOfPortalAfter).toBeGreaterThan(
				sdaiL1BalanceOfPortalBeforeDeposit
			);
			const sdaiAmountToBridge = BigInt(
				sdaiL1BalanceOfPortalAfter - sdaiL1BalanceOfPortalBeforeDeposit
			);

			// Wait for the archiver to process the message
			await sleep(5000);
			// send a transfer tx to force through rollup with the message included
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			console.log("26");

			// 6. claim sdai on L2
			logger("Consuming messages to mint sdai on L2");
			await sDAICrossChainHarness.consumeMessageOnAztecAndMintSecretly(
				secretHashForRedeemingSDAI,
				sdaiAmountToBridge,
				depositDaiMessageKey,
				secretForSDAIDeposit
			);
			console.log("27");
			await sDAICrossChainHarness.redeemShieldPrivatelyOnL2(
				sdaiAmountToBridge,
				secretForRedeemingSDAI
			);
			console.log("28");
			await sDAICrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				sdaiL2BalanceBeforeDeposit + sdaiAmountToBridge
			);

			console.log("29");
			const daiL2BalanceAfterDeposit =
				await daiCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);
			console.log("30");
			const sdaiL2BalanceAfterDeposit =
				await sDAICrossChainHarness.getL2PrivateBalanceOf(ownerAddress);

			logger(
				"DAI balance before deposit: " + daiL2BalanceBeforeDeposit.toString()
			);
			logger(
				"SDAI balance before deposit  : " +
					sdaiL2BalanceBeforeDeposit.toString()
			);
			logger("***** 🧚‍♀️ Deposit L2 assets on L1 Savings DAI 🧚‍♀️ *****");
			logger(
				"DAI balance after deposit : ",
				daiL2BalanceAfterDeposit.toString()
			);
			logger(
				"SDAI balance after deposit  : ",
				sdaiL2BalanceAfterDeposit.toString()
			);

			console.log(
				"DAI balance before deposit: " + daiL2BalanceBeforeDeposit.toString()
			);
			console.log(
				"SDAI balance before deposit  : " +
					sdaiL2BalanceBeforeDeposit.toString()
			);
			console.log("***** 🧚‍♀️ Deposit L2 assets on L1 Savings DAI 🧚‍♀️ *****");
			console.log(
				"DAI balance after deposit : ",
				daiL2BalanceAfterDeposit.toString()
			);
			console.log(
				"SDAI balance after deposit  : ",
				sdaiL2BalanceAfterDeposit.toString()
			);
		});

		// docs:start:uniswap_public
		it("should deposit on L1 from L2 funds publicly (swaps WETH -> DAI)", async () => {
			console.log("daiAmountToBridge: ", daiAmountToBridge);

			const daiL1BeforeBalance = await daiCrossChainHarness.getL1BalanceOf(
				ownerEthAddress
			);
			console.log("daiL1BeforeBalance: ", daiL1BeforeBalance);

			// 1. Approve and deposit dai to the portal and move to L2
			const [secretForMintingDai, secretHashForMintingDai] =
				await daiCrossChainHarness.generateClaimSecret();

			const messageKey = await daiCrossChainHarness.sendTokensToPortalPublic(
				daiAmountToBridge,
				secretHashForMintingDai
			);

			console.log(
				"await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress): ",
				await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress)
			);

			// funds transferred from owner to token portal
			expect(await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
				daiL1BeforeBalance - daiAmountToBridge
			);

			console.log("passed?");
			expect(
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				)
			).toBe(daiAmountToBridge);

			console.log("or here?");

			// Wait for the archiver to process the message
			await sleep(5000);

			// Perform an unrelated transaction on L2 to progress the rollup. Here we transfer 0 tokens
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			// 2. Claim DAI on L2
			logger("Minting dai on L2");
			console.log("Minting dai on L2");
			await daiCrossChainHarness.consumeMessageOnAztecAndMintPublicly(
				daiAmountToBridge,
				messageKey,
				secretForMintingDai
			);

			console.log("1");

			await daiCrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				daiAmountToBridge
			);

			console.log("2");

			// Store balances
			const daiL2BalanceBeforeDeposit =
				await daiCrossChainHarness.getL2PublicBalanceOf(ownerAddress);
			console.log("3");

			const sdaiL2BalanceBeforeDeposit =
				await sDAICrossChainHarness.getL2PublicBalanceOf(ownerAddress);

			console.log("4");

			// 3. Owner gives uniswap approval to transfer funds on its behalf
			const nonceForDAITransferApproval = new Fr(1n);
			const transferMessageHash = await computeAuthWitMessageHash(
				savingsDAIL2Contract.address,
				daiCrossChainHarness.l2Token.methods
					.transfer_public(
						ownerAddress,
						savingsDAIL2Contract.address,
						daiAmountToBridge,
						nonceForDAITransferApproval
					)
					.request()
			);
			console.log("5");

			await ownerWallet.setPublicAuth(transferMessageHash, true).send().wait();

			console.log("6");

			await sleep(5000);

			// before deposit - check nonce_for_burn_approval stored on uniswap
			// (which is used by uniswap to approve the bridge to burn funds on its behalf to exit to L1)
			const nonceForBurnApprovalBeforeDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();

			console.log("7");

			// 4. Deposit on L1 - sends L2 to L1 message to withdraw WETH to L1 and another message to deposit assets.
			const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
				await sDAICrossChainHarness.generateClaimSecret();

			console.log("8");

			// 4.1 Owner approves user to deposit on their behalf:
			const nonceForDeposit = new Fr(3n);
			const action = savingsDAIL2Contract
				.withWallet(sponsorWallet)
				.methods.deposit_public(
					ownerAddress,
					daiCrossChainHarness.l2Bridge.address,
					daiAmountToBridge,
					sDAICrossChainHarness.l2Bridge.address,
					nonceForDAITransferApproval,
					ownerAddress,
					secretHashForSDAIDeposit,
					deadlineForSDAIDeposit,
					ownerEthAddress,
					ownerEthAddress,
					nonceForDeposit
				);
			const swapMessageHash = await computeAuthWitMessageHash(
				sponsorAddress,
				action.request()
			);
			console.log("9");

			await ownerWallet.setPublicAuth(swapMessageHash, true).send().wait();

			console.log("10");

			// 4.2 Call swap_public from user2 on behalf of owner
			const withdrawReceipt = await action.send().wait();
			expect(withdrawReceipt.status).toBe(TxStatus.MINED);

			console.log("11");

			// check dai balance of owner on L2 (we first bridged `daiAmountToBridge` into L2 and now withdrew it!)
			await daiCrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				daiL2BalanceBeforeDeposit - daiAmountToBridge
			);

			console.log("12");

			// check burn approval nonce incremented:
			const nonceForBurnApprovalAfterDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();
			expect(nonceForBurnApprovalAfterDeposit).toBe(
				nonceForBurnApprovalBeforeDeposit + 1n
			);

			console.log("13");

			// 5. Perform the deposit on L1 with the `savingsDAIPortal.swap_private()` (consuming L2 to L1 messages)
			logger("Execute withdraw and deposit on the savingsDAIPortal!");
			const sdaiL1BalanceOfPortalBeforeDeposit =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);
			console.log("14");

			// Perform an unrelated transaction on L2 to progress the rollup. Here we transfer 0 tokens
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			const depositArgs = [
				daiCrossChainHarness.tokenPortalAddress.toString(),
				daiAmountToBridge,
				sDAICrossChainHarness.tokenPortalAddress.toString(),
				ownerAddress.toString(),
				secretHashForSDAIDeposit.toString(true),
				deadlineForSDAIDeposit,
				ownerEthAddress.toString(),
				true,
			] as const;

			const { result: depositDaiMessageKeyHex } =
				await savingsDAIPortal.simulate.depositPublic(depositArgs, {
					account: ownerEthAddress.toString(),
				} as any);

			console.log("15");

			// this should also insert a message into the inbox.
			await savingsDAIPortal.write.depositPublic(depositArgs, {} as any);

			console.log("16");

			const depositDaiMessageKey = Fr.fromString(depositDaiMessageKeyHex);
			// dai was swapped to sdai and send to portal
			const sdaiL1BalanceOfPortalAfter =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);
			console.log("17");

			expect(sdaiL1BalanceOfPortalAfter).toBeGreaterThan(
				sdaiL1BalanceOfPortalBeforeDeposit
			);
			const sdaiAmountToBridge = BigInt(
				sdaiL1BalanceOfPortalAfter - sdaiL1BalanceOfPortalBeforeDeposit
			);

			// Wait for the archiver to process the message
			await sleep(5000);
			// send a transfer tx to force through rollup with the message included
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			console.log("18");

			// 6. claim dai on L2
			logger("Consuming messages to mint sdai on L2");
			await sDAICrossChainHarness.consumeMessageOnAztecAndMintPublicly(
				sdaiAmountToBridge,
				depositDaiMessageKey,
				secretForSDAIDeposit
			);
			console.log("19");

			await sDAICrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				sdaiL2BalanceBeforeDeposit + sdaiAmountToBridge
			);

			console.log("20");

			const daiL2BalanceAfterDeposit =
				await daiCrossChainHarness.getL2PublicBalanceOf(ownerAddress);
			const sdaiL2BalanceAfterDeposit =
				await sDAICrossChainHarness.getL2PublicBalanceOf(ownerAddress);

			logger(
				"DAI balance before deposit: ",
				daiL2BalanceBeforeDeposit.toString()
			);
			logger(
				"SDAI balance before deposit  : ",
				sdaiL2BalanceBeforeDeposit.toString()
			);
			logger("***** 🧚‍♀️ Deposit L2 assets on L1 Savings DAI 🧚‍♀️ *****");
			logger(
				"DAI balance after deposit : ",
				daiL2BalanceAfterDeposit.toString()
			);
			logger(
				"SDAI balance after deposit  : ",
				sdaiL2BalanceAfterDeposit.toString()
			);

			console.log(
				"DAI balance before deposit: ",
				daiL2BalanceBeforeDeposit.toString()
			);
			console.log(
				"SDAI balance before deposit  : ",
				sdaiL2BalanceBeforeDeposit.toString()
			);
			console.log("***** 🧚‍♀️ Deposit L2 assets on L1 Savings DAI 🧚‍♀️ *****");
			console.log(
				"DAI balance after deposit : ",
				daiL2BalanceAfterDeposit.toString()
			);
			console.log(
				"SDAI balance after deposit  : ",
				sdaiL2BalanceAfterDeposit.toString()
			);
		});
	});
};
