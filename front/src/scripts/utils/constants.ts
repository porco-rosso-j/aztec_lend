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
} from "@aztec/aztec.js";
export const TOKEN_ADDRESSES = {
	DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
	SDAI: "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
	USDC: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
	CUSDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
};

export const CONTRACT_ADDRESSES = {};

export const PXE_URL = "http://localhost:8080";
export const RPC_URL = "http://localhost:8545";

export const userETHAddr: EthAddress =
	"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
export const userAztecAddr: AztecAddress = new AztecAddress(
	new Fr(
		0x25048e8c1b7dea68053d597ac2d920637c99523651edfb123d0632da785970d0n
	).toBuffer()
);

const userKey: GrumpkinScalar = {
	value:
		15073548173072628677506791134333543744757209793461900362372070659079016923777n,
};

export const userCompleteAddr = async (): Promise<CompleteAddress> => {
	const pxeClient = await createPXEClient(PXE_URL);
	console.log("1");
	return await pxeClient.getRegisteredAccount(userAztecAddr);
};

export const userWallet = async (): Promise<AccountWallet> => {
	const pxeClient = await createPXEClient(PXE_URL);
	const nodeInfo = await pxeClient.getNodeInfo();
	const accountContract = new SchnorrAccountContract(userKey);
	console.log("4");
	const entrypoint = await accountContract.getInterface(
		await userCompleteAddr(),
		nodeInfo
	);
	return new AccountWallet(pxeClient, entrypoint);
};

export const tokenPortalAddr: EthAddress =
	"0x7c02b58029beea7c1fcc872803dc9818f57a0e61";

export const tokenPortalAddresses = {
	DAI: "0xd28f3246f047efd4059b24fa1fa587ed9fa3e77f",
	SDAI: "0x31403b1e52051883f2ce1b1b4c89f36034e1221d",
};

export const l2TokenAddress = [
	// dai
	{
		aztecAddr: new AztecAddress(
			new Fr(
				0x091f1afa476e4755ba5ceee2f91e677bd9613e6018528c21dbfc2de02a2f8383n
			).toBuffer()
		),
		pubkey: new Point(new Fr(0n), new Fr(0n)),
		partialAddr: new Fr(
			13515066785944370507802173127046138374898832100657794410404654399198267762199n
		),
	},
	// sdai
	{
		aztecAddr: new AztecAddress(
			new Fr(
				0x0ab62fc7369597f526605850563945e247bb8499f146e367dc64e282ec17ab18n
			).toBuffer()
		),
		pubkey: new Point(new Fr(0n), new Fr(0n)),
		partialAddr: new Fr(
			9863292787200571724098897994273706474153265662694326585271054438522060681451n
		),
	},
	// usdc
	// {
	// 	aztecAddr: new AztecAddress(
	// 		new Fr(
	// 			0x1ee9c7b8de6324de7409b4c9b2cf23e093efc07f3e99f1f476f17878b03d68c4n
	// 		).toBuffer()
	// 	),
	// 	pubkey: new Point(new Fr(0n), new Fr(0n)),
	// 	partialAddr: new Fr(
	// 		12403513090622473966312841563184376924845710596673911367028356004584523039299n
	// 	),
	// },
	// // cusdc
	// {
	// 	aztecAddr: new AztecAddress(
	// 		new Fr(
	// 			0x1ee9c7b8de6324de7409b4c9b2cf23e093efc07f3e99f1f476f17878b03d68c4n
	// 		).toBuffer()
	// 	),
	// 	pubkey: new Point(new Fr(0n), new Fr(0n)),
	// 	partialAddr: new Fr(
	// 		12403513090622473966312841563184376924845710596673911367028356004584523039299n
	// 	),
	// },
];

export const l2BridgeAddress = [
	// dai
	{
		aztecAddr: new AztecAddress(
			new Fr(
				0x237209b8dfef1b2661ee188945099d910f958cd7f13a58f70e996d15ce83f8f3n
			).toBuffer()
		),
		pubkey: new Point(new Fr(0n), new Fr(0n)),
		partialAddr: new Fr(
			13991846404606834500115279901030844814639958103238176825748343820253533202232n
		),
	},
	// sdai
	{
		aztecAddr: new AztecAddress(
			new Fr(
				0x0de036a56ac806d253f4a02dadd9ec4b171065be5d3bbfd43827243529205998n
			).toBuffer()
		),
		pubkey: new Point(new Fr(0n), new Fr(0n)),
		partialAddr: new Fr(
			5779658186432173873611808080311185987439158562678236555621893127391823416861n
		),
	},
	// usdc
	// {
	// 	aztecAddr: new AztecAddress(
	// 		new Fr(
	// 			0x1ee9c7b8de6324de7409b4c9b2cf23e093efc07f3e99f1f476f17878b03d68c4n
	// 		).toBuffer()
	// 	),
	// 	pubkey: new Point(new Fr(0n), new Fr(0n)),
	// 	partialAddr: new Fr(
	// 		12403513090622473966312841563184376924845710596673911367028356004584523039299n
	// 	),
	// },
	// // cusdc
	// {
	// 	aztecAddr: new AztecAddress(
	// 		new Fr(
	// 			0x1ee9c7b8de6324de7409b4c9b2cf23e093efc07f3e99f1f476f17878b03d68c4n
	// 		).toBuffer()
	// 	),
	// 	pubkey: new Point(new Fr(0n), new Fr(0n)),
	// 	partialAddr: new Fr(
	// 		12403513090622473966312841563184376924845710596673911367028356004584523039299n
	// 	),
	// },
];
