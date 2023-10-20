import { getConfigEnvVars } from "@aztec/aztec-node";
import {
	PublicClient,
	TestClient,
	WalletClient,
	getContract,
	parseEther,
	Address
} from "viem";
import erc20 from "./erc20.json" assert { type: "json" };
import { localAnvil, MNEMONIC } from "../fixtures/fixtures.js";
import {
	createTestClient,
	http,
	createWalletClient,
	createPublicClient,
} from "viem";

export async function fundERC20(token: Address, user: string, amount: string) {
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
		(await getBalance(walletClient, publicClient, token, user)) >
		1000000000000000000000000n
	) {
		return;
	}

	let hash = await walletClient.writeContract({
		address: token,
		abi: erc20.abi,
		functionName: "transfer",
		args: [user, parseEther(amount)],
	});

	await testClient.stopImpersonatingAccount({ address: whale });
}

export async function getBalance(
	walletClient: WalletClient,
	publicClient: PublicClient,
	token: Address,
	user: string
): Promise<bigint> {
	const daiContract = getContract({
		address: token,
		abi: erc20.abi,
		walletClient,
		publicClient,
	});

	const balance: bigint | unknown = await daiContract.read.balanceOf([user]);

	return balance as bigint;
}

async function main() {
	await fundERC20("0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "1000000");
	// const { deployL1ContractsValues } = await setup(2, {})
	// await fundERC20(deployL1ContractsValues.walletClient, deployL1ContractsValues.publicClient)
}

main();
