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
	"0x7c02b58029beea7c1fcc872803dc9818f57a0e61";

export const aztecLendL2Addr: EthAddress =
	"0x1c049d3cd3f56551a8f1b1078ce6fbf7b745edb2358129b168582556ea5a635d";

export const l2TokenAddress = [
	"0x2f8c5fc55cc0f0c2d8c52c5d87bc6fa08e7ffc08c890e5d341c3c412b6eae052", // dai
	"0x06fac37a22f3bb7736f40fc1678629afa82d6c3f8a4179c3f590698a47613127", // sdai
];

export const l2BridgeAddress = [
	"0x21ad33eb2b35c1bce93aa9a18674e2fdb439202efec9dc7554bcd9a12d171ede", // dai
	"0x05464fd312333b490ba03a6561618b74ca8a0e7cc01f8c1c5a5af8a07fbd6091", // sdai
];

export const tokenPortalAddresses = {
	DAI: "0x1dbbf529d78d6507b0dd71f6c02f41138d828990",
	SDAI: "0x9a86494ba45ee1f9eeed9cfc0894f6c5d13a1f0b",
};
