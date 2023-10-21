import { setup as _setup, EndToEndContext } from "./setup/utils";
import { savingsDAIL1L2, SavingsDAISetupContext } from "./setup/aztec-lend";

const EXPECTED_FORKED_BLOCK = 18380756; //17514288;

export async function initialize() {
	const testSetup = async (): Promise<SavingsDAISetupContext> => {
		const {
			teardown: teardown_,
			pxe,
			deployL1ContractsValues,
			wallets,
			logger,
		} = await _setup(2, {});

		const walletClient = deployL1ContractsValues.walletClient;
		const publicClient = deployL1ContractsValues.publicClient;

		const ownerWallet = wallets[0];
		const sponsorWallet = wallets[1];

		//teardown = teardown_;

		return {
			pxe,
			logger,
			publicClient,
			walletClient,
			ownerWallet,
			sponsorWallet,
		};
	};

	await savingsDAIL1L2(testSetup, EXPECTED_FORKED_BLOCK);
}
