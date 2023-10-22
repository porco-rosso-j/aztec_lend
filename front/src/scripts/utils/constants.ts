import {
	AztecAddress,
	CompleteAddress,
	Fr,
	createPXEClient,
	GrumpkinScalar,
	SchnorrAccountContract,
	AccountWallet,
	EthAddress,
	AccountWalletWithPrivateKey,
} from "@aztec/aztec.js";

export const PXE_URL = "http://localhost:8080";
export const RPC_URL = "http://localhost:8545";
export const AZTEC_NODE_URL = "http://localhost:8079";

export const userETHAddr: EthAddress = new EthAddress(
	new Fr(0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266n).toBuffer()
);
export const userAztecAddr: AztecAddress = new AztecAddress(
	new Fr(
		0x25048e8c1b7dea68053d597ac2d920637c99523651edfb123d0632da785970d0n
	).toBuffer()
);

export const userKey: GrumpkinScalar = new GrumpkinScalar(
	15073548173072628677506791134333543744757209793461900362372070659079016923777n
);

export const userCompleteAddr = async (): Promise<CompleteAddress> => {
	const pxeClient = await createPXEClient(PXE_URL);
	return await pxeClient.getRegisteredAccount(userAztecAddr);
};

export const userWallet = async (): Promise<AccountWallet> => {
	const pxeClient = await createPXEClient(PXE_URL);
	const nodeInfo = await pxeClient.getNodeInfo();
	const accountContract = new SchnorrAccountContract(userKey);
	const entrypoint = await accountContract.getInterface(
		await userCompleteAddr(),
		nodeInfo
	);
	return new AccountWalletWithPrivateKey(pxeClient, entrypoint, userKey);
};

export const aztecLendPortalAddr: EthAddress =
	"0x1ec5df6299467fb19b4e425eb47df46c8f245078";

export const aztecLendL2Addr: EthAddress =
	"0x091a91697829b7e19bb68654bc909f8c31fb2de13568d6b22f15a803c9e79648";

export const DAI = {
	l1Address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
	l2Address: "0x0373539016127f44507ed664e496f6ff5224429092402cfb1137428a157b62f3",
	l1PortalAddress: "0x192ad6993aa1a7d642461c1d0e7224cf32b174e3",
	l2PortalAddress: "0x2ff33975a35c8f5b979db9bffbc2fc3481cbf43d7f2e36fe57ab73c51e74e927"
}

export const SDAI = {
	l1Address: "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
	l2Address: "0x20f0a60b5de20d025a6d18e9f63007404a1731a0de0ec8c8bbcc385f084c7be9",
	l1PortalAddress: "0xd4fa1258d1a60639e4c8bae59e3110054dd622cc",
	l2PortalAddress: "0x2befca0c9d17c6d6199aed56c9540f48c47f68af6bc2fa8f91416586bca3fc93"
}

export const USDC = {
	l1Address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	l2Address: "0x09825828fad898e8fcfc19320494c98d1e1c4ae70a1599d8e272d45d50b9421d",
	l1PortalAddress: "0xdf05d9c5ccff9bbb65d780746b7e829a4465a0a6",
	l2PortalAddress: "0x03ffa578f00a695df86d70d49439ba990726ec29496238950ccce145b2d39ce3"
}

export const CUSDC = {
	l1Address: "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
	l2Address: "0x0f52d8dd1d6169f0150b97dd877c190f4b014d34c1d2ef40c71a86380c5887f1",
	l1PortalAddress: "0x7c4d072293651df0bf274a454f4c3ec70fc5a866",
	l2PortalAddress: "0x238d1710b331897644d7403bb91a06ba696f573b8fe0775f51cffba791cb9d53"
}