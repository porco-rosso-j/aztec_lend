import {
	AccountWalletWithPrivateKey,
	CheatCodes,
	CompleteAddress,
	DebugLogger,
	EthCheatCodes,
	SentTx,
	createAccounts,
	createDebugLogger,
	createPXEClient,
	SchnorrAccountContract,
	PXE,
} from "@aztec/aztec.js";
import {
	Chain,
	HttpTransport,
	HDAccount,
	createWalletClient,
	createPublicClient,
	http,
} from "viem";
// import { AztecNode, createAztecNodeRpcClient } from "@aztec/types";
// import { PXEService, createPXEService, getPXEServiceConfig } from "@aztec/pxe";
import { localAnvil, MNEMONIC } from "./fixtures";
import { mnemonicToAccount } from "viem/accounts";
import { PXE_URL, RPC_URL } from "../constants";
import { userCompleteAddr, userKey, AZTEC_NODE_URL } from "../constants";

export async function init(opts = {}): Promise<any> {
	// const aztecNode = await createAztecNodeRpcClient(AZTEC_NODE_URL);
	// const pxeConfig = await getPXEServiceConfig();
	const hdAccount = mnemonicToAccount(MNEMONIC);
	const pxe: PXE = await createPXEClient(PXE_URL);
	console.log("pxe: ", await pxe.getNodeInfo());
	const wallet = await userWallet(pxe);

	const walletClient: any = createWalletClient<HttpTransport, Chain, HDAccount>(
		{
			account: hdAccount,
			chain: localAnvil,
			transport: http(RPC_URL),
		}
	);
	const publicClient: any = createPublicClient({
		chain: localAnvil,
		transport: http(RPC_URL),
	});

	return {
		wallet: wallet,
		walletClient: walletClient,
		publicClient: publicClient,
		pxeClient: pxe,
	};
}

const userWallet = async (pxe: PXE): Promise<AccountWalletWithPrivateKey> => {
	const nodeInfo = await pxe.getNodeInfo();
	const accountContract = new SchnorrAccountContract(userKey);
	const entrypoint = await accountContract.getInterface(
		await userCompleteAddr(),
		nodeInfo
	);
	return new AccountWalletWithPrivateKey(pxe, entrypoint, userKey);
};
