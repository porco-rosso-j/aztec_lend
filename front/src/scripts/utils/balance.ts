import {
	AztecAddress,
	CompleteAddress,
	Fr,
	Point,
	Wallet,
	PXE,
	createPXEClient,
	GrumpkinScalar,
	SchnorrAccountContract,
	AccountWallet,
} from "@aztec/aztec.js";
import {
	getContract,
	createWalletClient,
	createPublicClient,
	http,
	Hex,
} from "viem";
import erc20Artifact from "../sources/erc20.json";
// import { localAnvil } from "./setup/fixtures.js";
import { foundry, Chain } from "viem/chains";

import {
	TokenBridgeContract,
	TokenContract,
	AccountContract,
	//@ts-ignore
} from "@aztec/noir-contracts/types";
const RPC_URL = "http://localhost:8545";

const tokenAddresses = [
	"0x6B175474E89094C44Da98b954EedeAC495271d0F",
	"0x83F20F44975D03b1b09e64809B757c47f942BEeA",
	"0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
	"0xc3d688B66703497DAA19211EEdff47f25384cdc3",
];

// const l2daiCompAddr: CompleteAddress = {
// 	address: "0x23d33ed35c7ddc5e7691c36876e8a6e3b54dc34d2cf4ef277276569ed701bad8",
// 	publicKey: "",
// 	partialAddress: Fr(0),
// };

// const l2tokenAddresses: CompleteAddress[] = [l2daiCompAddr, l2daiCompAddr];

const user = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const userAztec: AztecAddress = new AztecAddress(
	new Fr(
		0x25048e8c1b7dea68053d597ac2d920637c99523651edfb123d0632da785970d0n
	).toBuffer()
);

const userKey: GrumpkinScalar = {
	value:
		15073548173072628677506791134333543744757209793461900362372070659079016923777n,
};

const localAnvil: Chain = foundry;
// export async function getBalances(): Promise<any> {
// 	const walletClient: any = createWalletClient({
// 		account: user,
// 		chain: localAnvil,
// 		transport: http(RPC_URL),
// 	});

// 	const publicClient: any = createPublicClient({
// 		chain: localAnvil,
// 		transport: http(RPC_URL),
// 	});

// 	let balances = [];
// 	let erc20Contract;
// 	let i = 0;
// 	for (i; i < tokenAddresses.length; ) {
// 		erc20Contract = getContract({
// 			address: tokenAddresses[i] as Hex,
// 			abi: erc20Artifact.abi,
// 			walletClient,
// 			publicClient,
// 		});

// 		balances[i] = await erc20Contract.read.balanceOf([user]);
// 		i = i + 1;
// 	}
// 	const tokenBalances = {
// 		DAI: balances[1] / 1e18,
// 		SDAI: balances[2] / 1e18,
// 		USDC: balances[3] / 1e6,
// 		CUSDC: balances[4] / 1e6,
// 	};
// 	return tokenBalances;
// }
const PXE_URL = "http://localhost:8080";

export async function getBalances(): Promise<any> {
	const pxeClient = await createPXEClient(PXE_URL);
	console.log("1");
	const userCompleteAddr = await pxeClient.getRegisteredAccount(userAztec);
	console.log("2");
	const nodeInfo = await pxeClient.getNodeInfo();
	console.log("3");
	const accountContract = new SchnorrAccountContract(userKey);
	console.log("4");
	const entrypoint = await accountContract.getInterface(
		userCompleteAddr,
		nodeInfo
	);
	const wallet = new AccountWallet(pxeClient, entrypoint);
	//return [0, 0, 0, 0];
	const azAddr: AztecAddress = new AztecAddress(
		new Fr(
			0x1042874a9c1fbeff6e6ccdafbcc399f1a34633dc90b2729380aad4d762c17b4an
		).toBuffer()
	);
	console.log("5");
	const pubkey = new Point(new Fr(0n), new Fr(0n));
	const compaddr = new CompleteAddress(
		azAddr,
		pubkey,
		new Fr(
			16456076394321641483713373906051443469338062872978062038569606196485370351298n
		)
	);
	console.log("6");
	console.log("7");

	let l2tokenContract: TokenContract;

	let balances: bigint[] = [];
	let i = 0;
	for (i; i < 2; ) {
		// l2tokenContract = await TokenContract.at(compaddr, wallet);
		l2tokenContract = new TokenContract(compaddr, wallet);
		// balances[i] = await l2tokenContract.methods
		// 	.balance_of_public(userAztec)
		// 	.view();
		balances[i] = await l2tokenContract.methods
			.balance_of_private(userAztec)
			.view({ from: userAztec });
		console.log("balances[i]: ", balances[i]);

		//balances[i] = await erc20Contract.read.balanceOf([user]);
		i = i + 1;
	}
	const tokenBalances = {
		DAI: balances[1],
		SDAI: balances[2],
		USDC: balances[3],
		CUSDC: balances[4],
	};
	return tokenBalances;
}
