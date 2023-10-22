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
	EthAddress,
	AccountWalletWithPrivateKey,
} from "@aztec/aztec.js";

export const TOKEN_ADDRESSES = {
	DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
	SDAI: "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
	USDC: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
	CUSDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
};

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
	"0x3576293ba6adacba1a81397db889558dd91a8519";

export const aztecLendL2Addr: EthAddress =
	"0x0c7ef2dd26669bcc9cf5fa821d0cdfe2aaa2386e3c493ccbaf8aae42f803ad0f";

export const l2TokenAddress = [
	"0x243234c1f942376937b19302a81ff1f914fded5ab72577d80871ad65b3510054", // dai
	"0x14f5bd4b03c6a96161d14e34670bf8b1f24734fad5436c083a37bed95d0060c0", // sdai
];

export const l2BridgeAddress = [
	"0x16f2b9b3b431fc408e8d1e1cfc09f809dca7841074e8b294c42ca0d92a6fa313", // dai
	"0x05d19f454c02289e338be0636d431f71a90596a6a64d43ae1b0e8f7b4c8bf78a", // sdai
];

export const tokenPortalAddresses = {
	DAI: "0x72ac6a36de2f72bd39e9c782e9db0dcc41febfe2",
	SDAI: "0xe634d83f8e016b04e51f2516e6086b5f238675c7",
};
