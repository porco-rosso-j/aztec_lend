import { getConfigEnvVars } from "@aztec/aztec-node";
import {
	PublicClient,
	TestClient,
	WalletClient,
	getContract,
	parseEther,
} from "viem";
import dai from "./erc20.json" assert { type: "json" };
import { localAnvil, MNEMONIC } from "../fixtures/fixtures.js";
import {
	createTestClient,
	http,
	createWalletClient,
	createPublicClient,
} from "viem";

export async function fundDAI(user: string) {
	const config = { ...getConfigEnvVars(), ...{} };

	const testClient: TestClient = createTestClient({
		chain: localAnvil,
		mode: "anvil",
		transport: http(),
	});

	const whale = "0x748dE14197922c4Ae258c7939C7739f3ff1db573"; // a whale
	await testClient.impersonateAccount({ address: whale });

	const walletClient = createWalletClient({
		account: whale,
		chain: localAnvil,
		transport: http(config.rpcUrl),
	});

	const publicClient = createPublicClient({
		// account: whale,
		chain: localAnvil,
		transport: http(config.rpcUrl),
	});

	if (
		(await getBalance(walletClient, publicClient, user)) >
		1000000000000000000000000n
	) {
		return;
	}

	await walletClient.writeContract({
		address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
		abi: dai.abi,
		functionName: "transfer",
		args: [user, parseEther("1000000")],
	});

	await testClient.stopImpersonatingAccount({ address: whale });
}

export async function getBalance(
	walletClient: WalletClient,
	publicClient: PublicClient,
	user: string
): Promise<bigint> {
	const daiContract = getContract({
		address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
		abi: dai.abi,
		walletClient,
		publicClient,
	});

	const balance: bigint | unknown = await daiContract.read.balanceOf([user]);

	return balance as bigint;
}

async function main() {
	await fundDAI("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
	// const { deployL1ContractsValues } = await setup(2, {})
	// await fundDAI(deployL1ContractsValues.walletClient, deployL1ContractsValues.publicClient)
}

main();
