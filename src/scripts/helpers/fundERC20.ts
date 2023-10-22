//import { getConfigEnvVars } from "@aztec/aztec-node";
import {
	Hex,
	PublicClient,
	TestClient,
	WalletClient,
	getContract,
	parseEther,
} from "viem";
import dai from "./erc20.json" assert { type: "json" };
// import { localAnvil, MNEMONIC } from "../fixtures.js";
import { localAnvil, MNEMONIC } from "../fixtures.js";
import {
	createTestClient,
	http,
	createWalletClient,
	createPublicClient,
} from "viem";
// const RPC_URL =
// 	"https://eth-mainnet.g.alchemy.com/v2/E-jGLB2HIoeK3ByPCNzjQfTVJD3dygEr";
const RPC_URL = "http://localhost:8545";

export async function fundDAI(user: string) {
	//const config = { ...getConfigEnvVars(), ...{} };

	const testClient: TestClient = createTestClient({
		chain: localAnvil,
		mode: "anvil",
		//transport: http(config.rpcUrl),
		transport: http(RPC_URL),
	});

	const whale = "0x748dE14197922c4Ae258c7939C7739f3ff1db573"; // a whale
	await testClient.impersonateAccount({ address: whale });

	const walletClient = createWalletClient({
		account: whale,
		chain: localAnvil,
		//transport: http(config.rpcUrl),
		transport: http(RPC_URL),
	});

	const publicClient = createPublicClient({
		chain: localAnvil,
		//transport: http(config.rpcUrl),
		transport: http(RPC_URL),
	});

	if (
		(await getBalance(walletClient, publicClient, user)) >
		1000000000000000000000000n
	) {
		return;
	}

	await walletClient.writeContract({
		account: whale,
		address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Hex,
		abi: dai.abi,
		functionName: "transfer",
		args: [user, parseEther("1000000")],
		chain: localAnvil,
	});

	await testClient.stopImpersonatingAccount({ address: whale });
}

export async function getBalance(
	walletClient: any,
	publicClient: any,
	user: string
): Promise<bigint> {
	const daiContract = getContract({
		address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
		abi: dai.abi,
		walletClient,
		publicClient,
	});

	//@ts-ignore
	const balance: bigint | unknown = await daiContract.read.balanceOf([user]);

	return balance as bigint;
}

async function main() {
	await fundDAI("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
	// const { deployL1ContractsValues } = await setup(2, {})
	// await fundDAI(deployL1ContractsValues.walletClient, deployL1ContractsValues.publicClient)
}

main();
