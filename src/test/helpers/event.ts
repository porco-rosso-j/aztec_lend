import { http, createPublicClient, Hex, decodeEventLog } from "viem";
import { getConfigEnvVars } from "@aztec/aztec-node";
import { localAnvil } from "../fixtures/fixtures.js";
import inboxArtifact from "../../../l1-contracts/artifacts/@aztec/l1-contracts/src/core/interfaces/messagebridge/IInbox.sol/IInbox.json" assert { type: "json" };

export async function getEntryKeyFromEvent(
	hash: string,
	inboxAddress: string
): Promise<string | undefined> {
	const config = { ...getConfigEnvVars(), ...{} };
	const publicClient = createPublicClient({
		chain: localAnvil,
		transport: http(config.rpcUrl),
	});

	const transaction = await publicClient.getTransactionReceipt({
		hash: hash as Hex,
	});

	let i = 0;
	let entryKey: string | undefined;
	for (i; i < transaction.logs.length; ) {
		if (
			transaction.logs[i].address == inboxAddress
		) {
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
