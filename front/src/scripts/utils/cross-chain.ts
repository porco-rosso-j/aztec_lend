// docs:start:cross_chain_test_harness
import {
	AztecAddress,
	EthAddress,
	Fr,
	NotePreimage,
	PXE,
	TxHash,
	computeMessageSecretHash,
} from "@aztec/aztec.js";

import {
	TokenBridgeContract,
	TokenContract,
	//@ts-ignore
} from "@aztec/noir-contracts/types";

import { Chain, HttpTransport, PublicClient } from "viem";

export class CrossChainHarness {
	constructor(
		/** Private eXecution Environment (PXE). */
		public pxeService: PXE,
		/** Logger. */
		// public logger: DebugLogger,

		/** L2 Token contract. */
		public l2Token: TokenContract,
		/** L2 Token bridge contract. */
		public l2Bridge: TokenBridgeContract,

		/** Eth account to interact with. */
		public ethAccount: EthAddress,

		/** Portal address. */
		public tokenPortalAddress: EthAddress,
		/** Token portal instance. */
		public tokenPortal: any,
		/** Underlying token for portal tests. */
		public underlyingERC20: any,
		/** Message Bridge Outbox. */
		public outbox: any,
		/** Viem Public client instance. */
		public publicClient: PublicClient<HttpTransport, Chain>,
		/** Viem Wallet Client instance. */
		public walletClient: any,

		/** Aztec address to use in tests. */
		public ownerAddress: AztecAddress
	) {}

	async generateClaimSecret(): Promise<[Fr, Fr]> {
		const secret = Fr.random();
		const secretHash = await computeMessageSecretHash(secret);
		return [secret, secretHash];
	}

	async mintTokensOnL1(amount: bigint) {
		await this.underlyingERC20.write.mint(
			[this.ethAccount.toString(), amount],
			{} as any
		);
	}

	async getL1BalanceOf(address: EthAddress) {
		return await this.underlyingERC20.read.balanceOf([address.toString()]);
	}

	async sendTokensToPortalPublic(bridgeAmount: bigint, secretHash: Fr) {
		await this.underlyingERC20.write.approve(
			[this.tokenPortalAddress.toString(), bridgeAmount],
			{} as any
		);

		// Deposit tokens to the TokenPortal
		const deadline = 2 ** 32 - 1; // max uint32
		const args = [
			this.ownerAddress.toString(),
			bridgeAmount,
			this.ethAccount.toString(),
			deadline,
			secretHash.toString(true),
		] as const;
		const { result: messageKeyHex } =
			await this.tokenPortal.simulate.depositToAztecPublic(args, {
				account: this.ethAccount.toString(),
			} as any);
		await this.tokenPortal.write.depositToAztecPublic(args, {} as any);

		return Fr.fromString(messageKeyHex);
	}

	async sendTokensToPortalPrivate(
		secretHashForRedeemingMintedNotes: Fr,
		bridgeAmount: bigint,
		secretHashForL2MessageConsumption: Fr
	) {
		await this.underlyingERC20.write.approve(
			[this.tokenPortalAddress.toString(), bridgeAmount],
			{} as any
		);

		// Deposit tokens to the TokenPortal
		const deadline = 2 ** 32 - 1; // max uint32

		const args = [
			secretHashForRedeemingMintedNotes.toString(true),
			bridgeAmount,
			this.ethAccount.toString(),
			deadline,
			secretHashForL2MessageConsumption.toString(true),
		] as const;
		const { result: messageKeyHex } =
			await this.tokenPortal.simulate.depositToAztecPrivate(args, {
				account: this.ethAccount.toString(),
			} as any);
		await this.tokenPortal.write.depositToAztecPrivate(args, {} as any);

		return Fr.fromString(messageKeyHex);
	}

	async mintTokensPublicOnL2(amount: bigint) {
		const tx = this.l2Token.methods
			.mint_public(this.ownerAddress, amount)
			.send();
		await tx.wait();
	}

	async mintTokensPrivateOnL2(amount: bigint, secretHash: Fr) {
		const tx = this.l2Token.methods.mint_private(amount, secretHash).send();
		const receipt = await tx.wait();
		await this.addPendingShieldNoteToPXE(amount, secretHash, receipt.txHash);
	}

	async performL2Transfer(
		transferAmount: bigint,
		receiverAddress: AztecAddress
	) {
		// send a transfer tx to force through rollup with the message included
		const transferTx = this.l2Token.methods
			.transfer_public(this.ownerAddress, receiverAddress, transferAmount, 0)
			.send();
		const receipt = await transferTx.wait();
	}

	async consumeMessageOnAztecAndMintSecretly(
		secretHashForRedeemingMintedNotes: Fr,
		bridgeAmount: bigint,
		messageKey: Fr,
		secretForL2MessageConsumption: Fr
	) {
		// Call the mint tokens function on the Aztec.nr contract
		const consumptionTx = this.l2Bridge.methods
			.claim_private(
				secretHashForRedeemingMintedNotes,
				bridgeAmount,
				this.ethAccount,
				messageKey,
				secretForL2MessageConsumption
			)
			.send();
		const consumptionReceipt = await consumptionTx.wait();
		console.log("consumptionReceipt: ", consumptionReceipt);
		console.log("consumptionReceipt.txHash: ", consumptionReceipt.txHash);

		await this.addPendingShieldNoteToPXE(
			bridgeAmount,
			secretHashForRedeemingMintedNotes,
			consumptionReceipt.txHash
		);
	}

	async withdrawPrivateFromAztecToL1(
		withdrawAmount: bigint,
		nonce: Fr = Fr.ZERO
	) {
		await this.l2Bridge.methods
			.exit_to_l1_private(
				this.l2Token.address,
				this.ethAccount,
				withdrawAmount,
				EthAddress.ZERO,
				nonce
			)
			.send()
			.wait();
	}

	async withdrawPublicFromAztecToL1(
		withdrawAmount: bigint,
		nonce: Fr = Fr.ZERO
	) {
		await this.l2Bridge.methods
			.exit_to_l1_public(
				this.ethAccount,
				withdrawAmount,
				EthAddress.ZERO,
				nonce
			)
			.send()
			.wait();
	}

	async getL2PrivateBalanceOf(owner: AztecAddress) {
		return await this.l2Token.methods
			.balance_of_private(owner)
			.view({ from: owner });
	}

	async getL2PublicBalanceOf(owner: AztecAddress) {
		return await this.l2Token.methods.balance_of_public(owner).view();
	}

	async withdrawFundsFromBridgeOnL1(withdrawAmount: bigint, entryKey: Fr) {
		//this.logger("Send L1 tx to consume entry and withdraw funds");
		// Call function on L1 contract to consume the message
		const { request: withdrawRequest, result: withdrawEntryKey } =
			await this.tokenPortal.simulate.withdraw([
				this.ethAccount.toString(),
				withdrawAmount,
				false,
			]);

		await this.walletClient.writeContract(withdrawRequest);
		return withdrawEntryKey;
	}

	async shieldFundsOnL2(shieldAmount: bigint, secretHash: Fr) {
		const shieldTx = this.l2Token.methods
			.shield(this.ownerAddress, shieldAmount, secretHash, 0)
			.send();
		const shieldReceipt = await shieldTx.wait();

		await this.addPendingShieldNoteToPXE(
			shieldAmount,
			secretHash,
			shieldReceipt.txHash
		);
	}

	async addPendingShieldNoteToPXE(
		shieldAmount: bigint,
		secretHash: Fr,
		txHash: TxHash
	) {
		console.log("pxeService: ", this.pxeService);

		//	this.logger("Adding note to PXE");
		const storageSlot = new Fr(5);
		const preimage = new NotePreimage([new Fr(shieldAmount), secretHash]);
		await this.pxeService.addNote(
			this.ownerAddress,
			this.l2Token.address,
			storageSlot,
			preimage,
			txHash
		);
	}

	async redeemShieldPrivatelyOnL2(shieldAmount: bigint, secret: Fr) {
		const privateTx = this.l2Token.methods
			.redeem_shield(this.ownerAddress, shieldAmount, secret)
			.send();
		await privateTx.wait();
	}

	async unshieldTokensOnL2(unshieldAmount: bigint, nonce = Fr.ZERO) {
		const unshieldTx = this.l2Token.methods
			.unshield(this.ownerAddress, this.ownerAddress, unshieldAmount, nonce)
			.send();
		await unshieldTx.wait();
	}
}
// docs:end:cross_chain_test_harness
