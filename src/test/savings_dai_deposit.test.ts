import { setup as e2eSetup } from "./fixtures/utils.js";
import {
	SavingsDAISetupContext,
	savingsDAIL1L2TestSuite,
} from "./shared/savings_dai_l1_l2.js";

const EXPECTED_FORKED_BLOCK = 18380756; //17514288;

let teardown: () => Promise<void>;

const testSetup = async (): Promise<SavingsDAISetupContext> => {
	const {
		teardown: teardown_,
		pxe,
		deployL1ContractsValues,
		wallets,
		logger,
	} = await e2eSetup(2, {});

	const walletClient = deployL1ContractsValues.walletClient;
	const publicClient = deployL1ContractsValues.publicClient;

	const ownerWallet = wallets[0];
	const sponsorWallet = wallets[1];

	teardown = teardown_;

	return {
		pxe,
		logger,
		publicClient,
		walletClient,
		ownerWallet,
		sponsorWallet,
	};
};

const testCleanup = async () => {
	await teardown();
};

savingsDAIL1L2TestSuite(testSetup, testCleanup, EXPECTED_FORKED_BLOCK);
