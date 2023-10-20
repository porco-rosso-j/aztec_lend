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
import { fundDAI } from "../helpers/fundERC20.js";
import { getEntryKeyFromEvent } from "../helpers/event.js";

const TIMEOUT = 250_000;

/** Objects to be returned by the azteclend setup function */
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

export const savingsDAIL1L2TestSuite = (
	setup: () => Promise<SavingsDAISetupContext>,
	cleanup: () => Promise<void>,
	expectedForkBlockNumber: number
) => {
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

		let sponsorWallet: AccountWallet;
		let sponsorAddress: AztecAddress;

		let daiCrossChainHarness: CrossChainTestHarness;
		let sDAICrossChainHarness: CrossChainTestHarness;

		let savingsDAIPortal: any;
		let savingsDAIPortalAddress: EthAddress;
		let savingsDAIL2Contract: SavingsDAIContract;

		const daiAmountToBridge = parseEther("1000");
		const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1); // max uint32

		let registryAddress: EthAddress;
		let inboxAddress: EthAddress;

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
			// deploy l2 azteclend contract and attach to portal
			savingsDAIL2Contract = await SavingsDAIContract.deploy(ownerWallet)
				.send({ portalContract: savingsDAIPortalAddress })
				.deployed();

			({ registryAddress, inboxAddress } = (await pxe.getNodeInfo()).l1ContractAddresses);

			await savingsDAIPortal.write.initialize(
				[registryAddress.toString(), savingsDAIL2Contract.address.toString()],
				{} as any
			);

			logger("Getting some dai");
			await fundDAI(ownerEthAddress.toString());
		});

		afterAll(async () => {
			await cleanup();
		});

		it("should deposit on L1 from L2 funds privately", async () => {
			const daiL1BeforeBalance = await daiCrossChainHarness.getL1BalanceOf(
				ownerEthAddress
			);

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

			// funds transferred from owner to token portal
			expect(await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
				daiL1BeforeBalance - daiAmountToBridge
			);

			expect(
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				)
			).toBe(daiAmountToBridge);

			// Wait for the archiver to process the message
			await sleep(5000);

			// Perform an unrelated transaction on L2 to progress the rollup. Here we mint public tokens.
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			// 2. Claim WETH on L2
			logger("Minting dai on L2");
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

			await daiCrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				daiAmountToBridge
			);

			// Store balances
			const daiL2BalanceBeforeDeposit =
				await daiCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);

			const sdaiL2BalanceBeforeDeposit =
				await sDAICrossChainHarness.getL2PrivateBalanceOf(ownerAddress);

			// before deposit - check nonce_for_burn_approval stored on azteclend
			// (which is used by azteclend to approve the bridge to burn funds on its behalf to exit to L1)
			const nonceForBurnApprovalBeforeDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();

			// 3. Owner gives azteclend approval to unshield funds to self on its behalf
			logger("Approving azteclend to unshield funds to self on my behalf");
			const nonceForDAIUnshieldApproval = new Fr(1n);
			const unshieldToAztecLendMessageHash = await computeAuthWitMessageHash(
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

			await ownerWallet.createAuthWitness(
				Fr.fromBuffer(unshieldToAztecLendMessageHash)
			);

			// 4. Deposit on L1 - sends L2 to L1 message to withdraw DAI to L1 and another message to deposit assets.
			logger(
				"Withdrawing dai to L1 and sending message to deposit to sdai contract"
			);
			const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
				await sDAICrossChainHarness.generateClaimSecret();

			const [secretForRedeemingSDAI, secretHashForRedeemingSDAI] =
				await sDAICrossChainHarness.generateClaimSecret();

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

			// ensure that user's funds were burnt
			await daiCrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				daiL2BalanceBeforeDeposit - daiAmountToBridge
			);

			// ensure that azteclend contract didn't eat the funds.
			await daiCrossChainHarness.expectPublicBalanceOnL2(
				savingsDAIL2Contract.address,
				0n
			);

			// check burn approval nonce incremented:
			const nonceForBurnApprovalAfterDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();
			expect(nonceForBurnApprovalAfterDeposit).toBe(
				nonceForBurnApprovalBeforeDeposit + 1n
			);

			// 5. Consume L2 to L1 message by calling savingsDAIPortal.deposit_private()
			logger("Execute withdraw and deposit on the savingsDAIPortal!" + daiAmountToBridge);
			const sdaiL1BalanceOfPortalBeforeDeposit =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

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

			// this should also insert a message into the inbox.
			const txhash = await savingsDAIPortal.write.depositPrivate(
				depositArgs,
				{} as any
			);

			await sleep(5000);

			// dai was swapped to sdai and send to portal
			const sdaiL1BalanceOfPortalAfter =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

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

			const entryKey = await getEntryKeyFromEvent(txhash, inboxAddress.toString());

			// 6. claim sdai on L2
			logger("Consuming messages to mint sdai on L2");
			await sDAICrossChainHarness.consumeMessageOnAztecAndMintSecretly(
				secretHashForRedeemingSDAI,
				sdaiAmountToBridge,
				Fr.fromString(entryKey as string),
				secretForSDAIDeposit
			);

			await sDAICrossChainHarness.redeemShieldPrivatelyOnL2(
				sdaiAmountToBridge,
				secretForRedeemingSDAI
			);

			await sDAICrossChainHarness.expectPrivateBalanceOnL2(
				ownerAddress,
				sdaiL2BalanceBeforeDeposit + sdaiAmountToBridge
			);

			const daiL2BalanceAfterDeposit =
				await daiCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);
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

		it("should deposit on L1 from L2 funds publicly (swaps DAI -> SDAI)", async () => {
			const daiL1BeforeBalance = await daiCrossChainHarness.getL1BalanceOf(
				ownerEthAddress
			);

			const daiL1BeforePortalBalance =
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				);

			// 1. Approve and deposit dai to the portal and move to L2
			const [secretForMintingDai, secretHashForMintingDai] =
				await daiCrossChainHarness.generateClaimSecret();

			const messageKey = await daiCrossChainHarness.sendTokensToPortalPublic(
				daiAmountToBridge,
				secretHashForMintingDai
			);

			// funds transferred from owner to token portal
			expect(await daiCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
				daiL1BeforeBalance - daiAmountToBridge
			);

			const daiL1AfterPortalBalance =
				daiAmountToBridge + daiL1BeforePortalBalance;
			expect(
				await daiCrossChainHarness.getL1BalanceOf(
					daiCrossChainHarness.tokenPortalAddress
				)
			).toBe(daiL1AfterPortalBalance);

			// Wait for the archiver to process the message
			await sleep(5000);

			// Perform an unrelated transaction on L2 to progress the rollup. Here we transfer 0 tokens
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			// 2. Claim DAI on L2
			logger("Minting dai on L2");
			await daiCrossChainHarness.consumeMessageOnAztecAndMintPublicly(
				daiAmountToBridge,
				messageKey,
				secretForMintingDai
			);

			await daiCrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				daiAmountToBridge
			);

			// Store balances
			const daiL2BalanceBeforeDeposit =
				await daiCrossChainHarness.getL2PublicBalanceOf(ownerAddress);

			const sdaiL2BalanceBeforeDeposit =
				await sDAICrossChainHarness.getL2PublicBalanceOf(ownerAddress);

			// 3. Owner gives azteclend approval to transfer funds on its behalf
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

			await ownerWallet.setPublicAuth(transferMessageHash, true).send().wait();

			await sleep(5000);

			// before deposit - check nonce_for_burn_approval stored on azteclend
			// (which is used by azteclend to approve the bridge to burn funds on its behalf to exit to L1)
			const nonceForBurnApprovalBeforeDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();

			// 4. Deposit on L1 - sends L2 to L1 message to withdraw WETH to L1 and another message to deposit assets.
			const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
				await sDAICrossChainHarness.generateClaimSecret();

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

			await ownerWallet.setPublicAuth(swapMessageHash, true).send().wait();

			// 4.2 Call swap_public from user2 on behalf of owner
			const withdrawReceipt = await action.send().wait();
			expect(withdrawReceipt.status).toBe(TxStatus.MINED);

			// check dai balance of owner on L2 (we first bridged `daiAmountToBridge` into L2 and now withdrew it!)
			await daiCrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				daiL2BalanceBeforeDeposit - daiAmountToBridge
			);

			// check burn approval nonce incremented:
			const nonceForBurnApprovalAfterDeposit =
				await savingsDAIL2Contract.methods.nonce_for_burn_approval().view();
			expect(nonceForBurnApprovalAfterDeposit).toBe(
				nonceForBurnApprovalBeforeDeposit + 1n
			);

			// 5. Perform the deposit on L1 with the `savingsDAIPortal.swap_private()` (consuming L2 to L1 messages)
			logger("Execute withdraw and deposit on the savingsDAIPortal!");
			const sdaiL1BalanceOfPortalBeforeDeposit =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

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

			// this should also insert a message into the inbox.
			const txhash = await savingsDAIPortal.write.depositPublic(
				depositArgs,
				{} as any
			);

			await sleep(5000);

			// dai was swapped to sdai and send to portal
			const sdaiL1BalanceOfPortalAfter =
				await sDAICrossChainHarness.getL1BalanceOf(
					sDAICrossChainHarness.tokenPortalAddress
				);

			expect(sdaiL1BalanceOfPortalAfter).toBeGreaterThan(
				sdaiL1BalanceOfPortalBeforeDeposit
			);
			const sdaiAmountToBridge = BigInt(
				sdaiL1BalanceOfPortalAfter - sdaiL1BalanceOfPortalBeforeDeposit
			);

			await sleep(5000);
			// send a transfer tx to force through rollup with the message included
			await daiCrossChainHarness.mintTokensPublicOnL2(0n);

			const entryKey = await getEntryKeyFromEvent(txhash, inboxAddress.toString());

			// 6. claim dai on L2
			logger("Consuming messages to mint sdai on L2");
			await sDAICrossChainHarness.consumeMessageOnAztecAndMintPublicly(
				sdaiAmountToBridge,
				Fr.fromString(entryKey as string),
				secretForSDAIDeposit
			);

			await sDAICrossChainHarness.expectPublicBalanceOnL2(
				ownerAddress,
				sdaiL2BalanceBeforeDeposit + sdaiAmountToBridge
			);

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
