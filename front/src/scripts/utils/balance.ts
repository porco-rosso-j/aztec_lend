import { DAI, SDAI, USDC, CUSDC, userWallet, userAztecAddr } from "./constants";
//@ts-ignore
import { TokenContract } from "@aztec/noir-contracts/types";

export async function getBalances(): Promise<any> {
	const tokenBalances = {
		DAI: await getBalance(DAI.l2Address) || 0,
		SDAI: await getBalance(SDAI.l2Address) || 0,
		USDC: await getBalance(USDC.l2Address) || 0,
		CUSDC: await getBalance(CUSDC.l2Address) || 0,
	};
	return tokenBalances;
}

async function getBalance(l2TokenAddress: string) {
	try {

		const l2tokenContract = await TokenContract.at(
			l2TokenAddress,
			await userWallet()
			);
			return await l2tokenContract.methods
			.balance_of_private(userAztecAddr)
			.view({ from: userAztecAddr });
	}
	catch {
		return null;
	}
}
