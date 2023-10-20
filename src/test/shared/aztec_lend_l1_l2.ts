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
import aztecLendPortalArtifact from "../../../l1-contracts/artifacts/contracts/AztecLendPortal.sol/AztecLendPortal.json";
import { AztecLendContract } from "../fixtures/AztecLend.js";
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
import { fundERC20 } from "../helpers/fundERC20.js";
import { getEntryKeyFromEvent } from "../helpers/event.js";

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

export const aztecLendL1L2TestSuite = (
	setup: () => Promise<AztecLendSetupContext>,
	cleanup: () => Promise<void>,
	expectedForkBlockNumber: number
) => {
	describe("AztecLend", () => {
		jest.setTimeout(TIMEOUT);

		let pxe: PXE;
		let logger: DebugLogger;

		let walletClient: any;
		let publicClient: PublicClient<HttpTransport, Chain>;

		let ownerWallet: AccountWallet;
		let ownerAddress: AztecAddress;
		let ownerEthAddress: EthAddress;

		let sponsorWallet: AccountWallet;
		let sponsorAddress: AztecAddress;

		let aztecLendPortal: any;
		let aztecLendPortalAddress: EthAddress;
		let aztecLendL2Contract: AztecLendContract;

		let registryAddress: EthAddress;
		let inboxAddress: EthAddress;

		beforeAll(async () => {
			({ pxe, logger, publicClient, walletClient, ownerWallet, sponsorWallet } =
				await setup());
	
			if (Number(await publicClient.getBlockNumber()) < expectedForkBlockNumber) {
				throw new Error(
					"This test must be run on a fork of mainnet with the expected fork block"
				);
			}
	
			ownerAddress = ownerWallet.getAddress();
			sponsorAddress = sponsorWallet.getAddress();
			ownerEthAddress = EthAddress.fromString(
				(await walletClient.getAddresses())[0]
			);
	
			logger("Deploy AztecLend portal on L1 and L2...");
			aztecLendPortalAddress = await deployL1Contract(
				walletClient,
				publicClient,
				aztecLendPortalArtifact.abi,
				aztecLendPortalArtifact.bytecode as Hex
			);

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

			({ registryAddress, inboxAddress } = (await pxe.getNodeInfo()).l1ContractAddresses);

			await aztecLendPortal.write.initialize(
				[registryAddress.toString(), aztecLendL2Contract.address.toString()],
				{} as any
			);
		});
	
		afterAll(async () => {
			await cleanup();
		});

		describe("DAI", () => {
			const DAI_ADDRESS: EthAddress = EthAddress.fromString(
				"0x6B175474E89094C44Da98b954EedeAC495271d0F"
			);
			const SDAI_ADDRESS: EthAddress = EthAddress.fromString(
				"0x83F20F44975D03b1b09e64809B757c47f942BEeA"
			);

			let daiCrossChainHarness: CrossChainTestHarness;
			let sDAICrossChainHarness: CrossChainTestHarness;

			const daiAmountToBridge = parseEther("1000");
			const deadlineForSDAIDeposit = BigInt(2 ** 32 - 1); // max uint32

			beforeAll(async () => {
				logger("Deploying DAI Portal, initializing and deploying l2 contract...");
				daiCrossChainHarness = await CrossChainTestHarness.new(
					pxe,
					publicClient,
					walletClient,
					ownerWallet,
					logger,
					DAI_ADDRESS
				);
	
				logger("Deploying sDAI Portal, initializing and deploying l2 contract...");
				sDAICrossChainHarness = await CrossChainTestHarness.new(
					pxe,
					publicClient,
					walletClient,
					ownerWallet,
					logger,
					SDAI_ADDRESS
				);
	
				logger("Getting some dai");
				await fundERC20(DAI_ADDRESS.toString(), ownerEthAddress.toString(), "1000000");
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
	
				// 2. Claim DAI on L2
				logger("Minting DAI on L2");
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
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
	
				// 3. Owner gives azteclend approval to unshield funds to self on its behalf
				logger("Approving azteclend to unshield funds to self on my behalf");
				const nonceForDAIUnshieldApproval = new Fr(1n);
				const unshieldToAztecLendMessageHash = await computeAuthWitMessageHash(
					aztecLendL2Contract.address,
					daiCrossChainHarness.l2Token.methods
						.unshield(
							ownerAddress,
							aztecLendL2Contract.address,
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
	
				const withdrawReceipt = await aztecLendL2Contract.methods
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
					aztecLendL2Contract.address,
					0n
				);
	
				// check burn approval nonce incremented:
				const nonceForBurnApprovalAfterDeposit =
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
				expect(nonceForBurnApprovalAfterDeposit).toBe(
					nonceForBurnApprovalBeforeDeposit + 1n
				);
	
				// 5. Consume L2 to L1 message by calling aztecLendPortal.deposit_private()
				logger("Execute withdraw and deposit on the aztecLendPortal!" + daiAmountToBridge);
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
				const txhash = await aztecLendPortal.write.depositPrivate(
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
				logger("***** 🧚‍♀️ Deposit L2 assets on L1 Aztec Lend 🧚‍♀️ *****");
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
				console.log("***** 🧚‍♀️ Deposit L2 assets on L1 Aztec Lend 🧚‍♀️ *****");
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
				logger("Minting DAI on L2");
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
					aztecLendL2Contract.address,
					daiCrossChainHarness.l2Token.methods
						.transfer_public(
							ownerAddress,
							aztecLendL2Contract.address,
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
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
	
				// 4. Deposit on L1 - sends L2 to L1 message to withdraw WETH to L1 and another message to deposit assets.
				const [secretForSDAIDeposit, secretHashForSDAIDeposit] =
					await sDAICrossChainHarness.generateClaimSecret();
	
				// 4.1 Owner approves user to deposit on their behalf:
				const nonceForDeposit = new Fr(3n);
				const action = aztecLendL2Contract
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
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
				expect(nonceForBurnApprovalAfterDeposit).toBe(
					nonceForBurnApprovalBeforeDeposit + 1n
				);
	
				// 5. Perform the deposit on L1 with the `aztecLendPortal.swap_private()` (consuming L2 to L1 messages)
				logger("Execute withdraw and deposit on the aztecLendPortal!");
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
				const txhash = await aztecLendPortal.write.depositPublic(
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
				logger("***** 🧚‍♀️ Deposit L2 assets on L1 Aztec Lend 🧚‍♀️ *****");
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
				console.log("***** 🧚‍♀️ Deposit L2 assets on L1 Aztec Lend 🧚‍♀️ *****");
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

		describe("USDC", () => {
			const USDC_ADDRESS: EthAddress = EthAddress.fromString(
				"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			);
			const CUSDC_ADDRESS: EthAddress = EthAddress.fromString(
				"0x39AA39c021dfbaE8faC545936693aC917d5E7563"
			);

			let usdcCrossChainHarness: CrossChainTestHarness;
			let cUsdcCrossChainHarness: CrossChainTestHarness;

			const usdcAmountToBridge = parseEther("0.000000002500");
			const deadlineForCUsdcDeposit = BigInt(2 ** 32 - 1); // max uint32

			beforeAll(async () => {
				logger("Deploying USDC Portal, initializing and deploying l2 contract...");
				usdcCrossChainHarness = await CrossChainTestHarness.new(
					pxe,
					publicClient,
					walletClient,
					ownerWallet,
					logger,
					USDC_ADDRESS
				);
	
				logger("Deploying cUSDC Portal, initializing and deploying l2 contract...");
				cUsdcCrossChainHarness = await CrossChainTestHarness.new(
					pxe,
					publicClient,
					walletClient,
					ownerWallet,
					logger,
					CUSDC_ADDRESS
				);
	
				logger("Getting some usdc");
				await fundERC20(USDC_ADDRESS.toString(), ownerEthAddress.toString(), "0.0000001"); // 1 million USDC (has 6 decimals)
			});

			it("should deposit on L1 from L2 funds privately", async () => {
				const usdcL1BeforeBalance = await usdcCrossChainHarness.getL1BalanceOf(
					ownerEthAddress
				);
	
				// 1. Approve and deposit usdc to the portal and move to L2
				const [secretForMintingUsdc, secretHashForMintingUsdc] =
					await usdcCrossChainHarness.generateClaimSecret();
	
				const [secretForRedeemingUsdc, secretHashForRedeemingUsdc] =
					await usdcCrossChainHarness.generateClaimSecret();
	
				const messageKey = await usdcCrossChainHarness.sendTokensToPortalPrivate(
					secretHashForRedeemingUsdc,
					usdcAmountToBridge,
					secretHashForMintingUsdc
				);
	
				// funds transferred from owner to token portal
				expect(await usdcCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
					usdcL1BeforeBalance - usdcAmountToBridge
				);
	
				expect(
					await usdcCrossChainHarness.getL1BalanceOf(
						usdcCrossChainHarness.tokenPortalAddress
					)
				).toBe(usdcAmountToBridge);
	
				// Wait for the archiver to process the message
				await sleep(5000);
	
				// Perform an unrelated transaction on L2 to progress the rollup. Here we mint public tokens.
				await usdcCrossChainHarness.mintTokensPublicOnL2(0n);
	
				// 2. Claim USDC on L2
				logger("Minting usdc on L2");
				await usdcCrossChainHarness.consumeMessageOnAztecAndMintSecretly(
					secretHashForRedeemingUsdc,
					usdcAmountToBridge,
					messageKey,
					secretForMintingUsdc
				);
	
				await usdcCrossChainHarness.redeemShieldPrivatelyOnL2(
					usdcAmountToBridge,
					secretForRedeemingUsdc
				);
	
				await usdcCrossChainHarness.expectPrivateBalanceOnL2(
					ownerAddress,
					usdcAmountToBridge
				);
	
				// Store balances
				const usdcL2BalanceBeforeDeposit =
					await usdcCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);
	
				const cUsdcL2BalanceBeforeDeposit =
					await cUsdcCrossChainHarness.getL2PrivateBalanceOf(ownerAddress);
	
				// before deposit - check nonce_for_burn_approval stored on azteclend
				// (which is used by azteclend to approve the bridge to burn funds on its behalf to exit to L1)
				const nonceForBurnApprovalBeforeDeposit =
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
	
				// 3. Owner gives azteclend approval to unshield funds to self on its behalf
				logger("Approving azteclend to unshield funds to self on my behalf");
				const nonceForUSDCUnshieldApproval = new Fr(1n);
				const unshieldToAztecLendMessageHash = await computeAuthWitMessageHash(
					aztecLendL2Contract.address,
					usdcCrossChainHarness.l2Token.methods
						.unshield(
							ownerAddress,
							aztecLendL2Contract.address,
							usdcAmountToBridge,
							nonceForUSDCUnshieldApproval
						)
						.request()
				);
	
				await ownerWallet.createAuthWitness(
					Fr.fromBuffer(unshieldToAztecLendMessageHash)
				);
	
				// 4. Deposit on L1 - sends L2 to L1 message to withdraw USDC to L1 and another message to deposit assets.
				logger(
					"Withdrawing USDC to L1 and sending message to deposit to cUSDC contract"
				);
				const [secretForCUSDCDeposit, secretHashForCUSDCDeposit] =
					await cUsdcCrossChainHarness.generateClaimSecret();
	
				const [secretForRedeemingCUSDC, secretHashForRedeemingCUSDC] =
					await cUsdcCrossChainHarness.generateClaimSecret();
	
				const withdrawReceipt = await aztecLendL2Contract.methods
					.deposit_private(
						usdcCrossChainHarness.l2Token.address,
						usdcCrossChainHarness.l2Bridge.address,
						usdcAmountToBridge,
						cUsdcCrossChainHarness.l2Bridge.address,
						nonceForUSDCUnshieldApproval,
						secretHashForRedeemingCUSDC,
						secretHashForCUSDCDeposit,
						deadlineForCUsdcDeposit,
						ownerEthAddress,
						ownerEthAddress
					)
					.send()
					.wait();
				expect(withdrawReceipt.status).toBe(TxStatus.MINED);
	
				// ensure that user's funds were burnt
				await usdcCrossChainHarness.expectPrivateBalanceOnL2(
					ownerAddress,
					usdcL2BalanceBeforeDeposit - usdcAmountToBridge
				);
	
				// ensure that azteclend contract didn't eat the funds.
				await usdcCrossChainHarness.expectPublicBalanceOnL2(
					aztecLendL2Contract.address,
					0n
				);
	
				// check burn approval nonce incremented:
				const nonceForBurnApprovalAfterDeposit =
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
				expect(nonceForBurnApprovalAfterDeposit).toBe(
					nonceForBurnApprovalBeforeDeposit + 1n
				);
	
				// 5. Consume L2 to L1 message by calling aztecLendPortal.deposit_private()
				logger("Execute withdraw and deposit on the aztecLendPortal!" + usdcAmountToBridge);
				const cUsdcL1BalanceOfPortalBeforeDeposit =
					await cUsdcCrossChainHarness.getL1BalanceOf(
						cUsdcCrossChainHarness.tokenPortalAddress
					);
	
				const depositArgs = [
					usdcCrossChainHarness.tokenPortalAddress.toString(),
					usdcAmountToBridge,
					cUsdcCrossChainHarness.tokenPortalAddress.toString(),
					secretHashForRedeemingCUSDC.toString(true),
					secretHashForCUSDCDeposit.toString(true),
					deadlineForCUsdcDeposit,
					ownerEthAddress.toString(),
					true,
				] as const;
	
				// this should also insert a message into the inbox.
				const txhash = await aztecLendPortal.write.depositPrivate(
					depositArgs,
					{} as any
				);
	
				await sleep(5000);
	
				const cUsdcL1BalanceOfPortalAfter =
					await cUsdcCrossChainHarness.getL1BalanceOf(
						cUsdcCrossChainHarness.tokenPortalAddress
					);
	
				expect(cUsdcL1BalanceOfPortalAfter).toBeGreaterThan(
					cUsdcL1BalanceOfPortalBeforeDeposit
				);
	
				const cusdcAmountToBridge = BigInt(
					cUsdcL1BalanceOfPortalAfter - cUsdcL1BalanceOfPortalBeforeDeposit
				);
	
				// Wait for the archiver to process the message
				await sleep(5000);
				// send a transfer tx to force through rollup with the message included
				await usdcCrossChainHarness.mintTokensPublicOnL2(0n);
	
				const entryKey = await getEntryKeyFromEvent(txhash, inboxAddress.toString());
	
				// 6. claim cUSDC on L2
				logger("Consuming messages to mint cUSDC on L2");
				await cUsdcCrossChainHarness.consumeMessageOnAztecAndMintSecretly(
					secretHashForRedeemingCUSDC,
					cusdcAmountToBridge,
					Fr.fromString(entryKey as string),
					secretForCUSDCDeposit
				);
	
				await cUsdcCrossChainHarness.redeemShieldPrivatelyOnL2(
					cusdcAmountToBridge,
					secretForRedeemingCUSDC
				);
	
				await cUsdcCrossChainHarness.expectPrivateBalanceOnL2(
					ownerAddress,
					cUsdcL2BalanceBeforeDeposit + cusdcAmountToBridge
				);
			});
	
			it("should deposit on L1 from L2 funds publicly (swaps USDC -> cUSDC)", async () => {
				const usdcL1BeforeBalance = await usdcCrossChainHarness.getL1BalanceOf(
					ownerEthAddress
				);
	
				const usdcL1BeforePortalBalance =
					await usdcCrossChainHarness.getL1BalanceOf(
						usdcCrossChainHarness.tokenPortalAddress
					);
	
				// 1. Approve and deposit USDC to the portal and move to L2
				const [secretForMintingUsdc, secretHashForMintingUsdc] =
					await usdcCrossChainHarness.generateClaimSecret();
	
				const messageKey = await usdcCrossChainHarness.sendTokensToPortalPublic(
					usdcAmountToBridge,
					secretHashForMintingUsdc
				);
	
				// funds transferred from owner to token portal
				expect(await usdcCrossChainHarness.getL1BalanceOf(ownerEthAddress)).toBe(
					usdcL1BeforeBalance - usdcAmountToBridge
				);
	
				const usdcL1AfterPortalBalance =
					usdcAmountToBridge + usdcL1BeforePortalBalance;
				expect(
					await usdcCrossChainHarness.getL1BalanceOf(
						usdcCrossChainHarness.tokenPortalAddress
					)
				).toBe(usdcL1AfterPortalBalance);
	
				// Wait for the archiver to process the message
				await sleep(5000);
	
				// Perform an unrelated transaction on L2 to progress the rollup. Here we transfer 0 tokens
				await usdcCrossChainHarness.mintTokensPublicOnL2(0n);
	
				// 2. Claim USDC on L2
				logger("Minting USDC on L2");
				await usdcCrossChainHarness.consumeMessageOnAztecAndMintPublicly(
					usdcAmountToBridge,
					messageKey,
					secretForMintingUsdc
				);
	
				await usdcCrossChainHarness.expectPublicBalanceOnL2(
					ownerAddress,
					usdcAmountToBridge
				);
	
				// Store balances
				const usdcL2BalanceBeforeDeposit =
					await usdcCrossChainHarness.getL2PublicBalanceOf(ownerAddress);
	
				const cusdcL2BalanceBeforeDeposit =
					await cUsdcCrossChainHarness.getL2PublicBalanceOf(ownerAddress);
	
				// 3. Owner gives azteclend approval to transfer funds on its behalf
				const nonceForUSDCTransferApproval = new Fr(1n);
				const transferMessageHash = await computeAuthWitMessageHash(
					aztecLendL2Contract.address,
					usdcCrossChainHarness.l2Token.methods
						.transfer_public(
							ownerAddress,
							aztecLendL2Contract.address,
							usdcAmountToBridge,
							nonceForUSDCTransferApproval
						)
						.request()
				);
	
				await ownerWallet.setPublicAuth(transferMessageHash, true).send().wait();
	
				await sleep(5000);
	
				// before deposit - check nonce_for_burn_approval stored on azteclend
				// (which is used by azteclend to approve the bridge to burn funds on its behalf to exit to L1)
				const nonceForBurnApprovalBeforeDeposit =
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
	
				// 4. Deposit on L1 - sends L2 to L1 message to withdraw WETH to L1 and another message to deposit assets.
				const [secretForCUSDCDeposit, secretHashForCUSDCDeposit] =
					await cUsdcCrossChainHarness.generateClaimSecret();
	
				// 4.1 Owner approves user to deposit on their behalf:
				const nonceForDeposit = new Fr(3n);
				const action = aztecLendL2Contract
					.withWallet(sponsorWallet)
					.methods.deposit_public(
						ownerAddress,
						usdcCrossChainHarness.l2Bridge.address,
						usdcAmountToBridge,
						cUsdcCrossChainHarness.l2Bridge.address,
						nonceForUSDCTransferApproval,
						ownerAddress,
						secretHashForCUSDCDeposit,
						deadlineForCUsdcDeposit,
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
	
				// check USDC balance of owner on L2 (we first bridged `usdcAmountToBridge` into L2 and now withdrew it!)
				await usdcCrossChainHarness.expectPublicBalanceOnL2(
					ownerAddress,
					usdcL2BalanceBeforeDeposit - usdcAmountToBridge
				);
	
				// check burn approval nonce incremented:
				const nonceForBurnApprovalAfterDeposit =
					await aztecLendL2Contract.methods.nonce_for_burn_approval().view();
				expect(nonceForBurnApprovalAfterDeposit).toBe(
					nonceForBurnApprovalBeforeDeposit + 1n
				);
	
				// 5. Perform the deposit on L1 with the `aztecLendPortal.swap_private()` (consuming L2 to L1 messages)
				logger("Execute withdraw and deposit on the aztecLendPortal!");
				const cusdcL1BalanceOfPortalBeforeDeposit =
					await cUsdcCrossChainHarness.getL1BalanceOf(
						cUsdcCrossChainHarness.tokenPortalAddress
					);
	
				const depositArgs = [
					usdcCrossChainHarness.tokenPortalAddress.toString(),
					usdcAmountToBridge,
					cUsdcCrossChainHarness.tokenPortalAddress.toString(),
					ownerAddress.toString(),
					secretHashForCUSDCDeposit.toString(true),
					deadlineForCUsdcDeposit,
					ownerEthAddress.toString(),
					true,
				] as const;
	
				// this should also insert a message into the inbox.
				const txhash = await aztecLendPortal.write.depositPublic(
					depositArgs,
					{} as any
				);
	
				await sleep(5000);
	
				// USDC was swapped to cUSDC and send to portal
				const cusdcL1BalanceOfPortalAfter =
					await cUsdcCrossChainHarness.getL1BalanceOf(
						cUsdcCrossChainHarness.tokenPortalAddress
					);
	
				expect(cusdcL1BalanceOfPortalAfter).toBeGreaterThan(
					cusdcL1BalanceOfPortalBeforeDeposit
				);
				const cusdcAmountToBridge = BigInt(
					cusdcL1BalanceOfPortalAfter - cusdcL1BalanceOfPortalBeforeDeposit
				);
	
				await sleep(5000);
				// send a transfer tx to force through rollup with the message included
				await usdcCrossChainHarness.mintTokensPublicOnL2(0n);
	
				const entryKey = await getEntryKeyFromEvent(txhash, inboxAddress.toString());
	
				// 6. claim USDC on L2
				logger("Consuming messages to mint cUSDC on L2");
				await cUsdcCrossChainHarness.consumeMessageOnAztecAndMintPublicly(
					cusdcAmountToBridge,
					Fr.fromString(entryKey as string),
					secretForCUSDCDeposit
				);
	
				await cUsdcCrossChainHarness.expectPublicBalanceOnL2(
					ownerAddress,
					cusdcL2BalanceBeforeDeposit + cusdcAmountToBridge
				);
			});
		});
	});
};
