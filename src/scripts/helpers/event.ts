import { http, createPublicClient, Hex, decodeEventLog } from "viem";
// import { getConfigEnvVars } from "@aztec/aztec-node";
import { localAnvil } from "../fixtures.js";
import inboxArtifact from "../../../sources/IInbox.json" assert { type: "json" };
const RPC_URL = "http://localhost:8545";

export async function getEntryKeyFromEvent(
	hash: string,
	inboxAddress: string
): Promise<string | undefined> {
	// const config = { ...getConfigEnvVars(), ...{} };
	const publicClient = createPublicClient({
		chain: localAnvil,
		//transport: http(config.rpcUrl),
		transport: http(RPC_URL),
	});

	const transaction = await publicClient.getTransactionReceipt({
		hash: hash as Hex,
	});

	let i = 0;
	let entryKey: string | undefined;
	for (i; i < transaction.logs.length; ) {
		if (transaction.logs[i].address == inboxAddress) {
			const decodedTopics = decodeEventLog({
				abi: inboxArtifact.abi,
				data: transaction.logs[i].data,
				topics: transaction.logs[i].topics,
			});

			const args: any = decodedTopics.args;
			entryKey = args.entryKey;
		}
		i = i + 1;
	}

	return entryKey;
}
