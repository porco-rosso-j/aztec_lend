import {
	DAI,
	SDAI
} from "./utils/constants";
import { depositERC20, TokenConfig } from "./deposit";

export async function depositDAI(amount: number) {
	const config: TokenConfig =	{
		depositToken: DAI.l1Address,
		depositTokenPortal: DAI.l1PortalAddress,
		depositTokenL2Address: DAI.l2Address,
		depositTokenPortalL2Address: DAI.l2PortalAddress,
		redeemToken: SDAI.l1Address,
		redeemTokenPortal: SDAI.l1PortalAddress,
		redeemTokenL2Address: SDAI.l2Address,
		redeemTokenPortalL2Address: SDAI.l2PortalAddress
	};

	await depositERC20(config, amount);
}

export async function withdrawSDAI(amount: number) {
	const config: TokenConfig =	{
		depositToken: SDAI.l1Address,
		depositTokenPortal: SDAI.l1PortalAddress,
		depositTokenL2Address: SDAI.l2Address,
		depositTokenPortalL2Address: SDAI.l2PortalAddress,
		redeemToken: DAI.l1Address,
		redeemTokenPortal: DAI.l1PortalAddress,
		redeemTokenL2Address: DAI.l2Address,
		redeemTokenPortalL2Address: DAI.l2PortalAddress
	};

	await depositERC20(config, amount);
}
