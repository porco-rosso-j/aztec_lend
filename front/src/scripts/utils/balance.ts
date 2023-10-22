import { CompleteAddress } from "@aztec/aztec.js";
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
	l2TokenAddress,
	userWallet,
	userCompleteAddr,
	userAztecAddr,
	TOKEN_ADDRESSES,
} from "./constants";
//@ts-ignore
import { TokenContract } from "@aztec/noir-contracts/types";

export async function getBalances(): Promise<any> {
	let l2tokenContract: TokenContract;

	let balances: bigint[] = [];
	let i = 0;
	for (i; i < l2TokenAddress.length; ) {
		// const tokenCompleteAddr = new CompleteAddress(
		// 	l2TokenAddress[i].aztecAddr,
		// 	l2TokenAddress[i].pubkey,
		// 	l2TokenAddress[i].partialAddr
		// );
		l2tokenContract = await TokenContract.at(
			l2TokenAddress[i],
			await userWallet()
		);
		balances[i] = await l2tokenContract.methods
			.balance_of_private(userAztecAddr)
			.view({ from: userAztecAddr });
		console.log("balances[i]: ", balances[i]);
		i = i + 1;
	}
	const tokenBalances = {
		DAI: balances[0],
		SDAI: balances[1],
		USDC: balances[2] || 0,
		CUSDC: balances[3] || 0,
	};
	return tokenBalances;
}

// balances[i] = await l2tokenContract.methods
// 	.balance_of_public(userAztecAddr)
// 	.view();

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
