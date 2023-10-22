import {
	USDC,
	CUSDC
} from "./utils/constants";
import { depositERC20, TokenConfig } from "./deposit";

export async function depositUSDC(amount: number) {
	const config: TokenConfig =	{
		depositToken: USDC.l1Address,
		depositTokenPortal: USDC.l1PortalAddress,
		depositTokenL2Address: USDC.l2Address,
		depositTokenPortalL2Address: USDC.l2PortalAddress,
		redeemToken: CUSDC.l1Address,
		redeemTokenPortal: CUSDC.l1PortalAddress,
		redeemTokenL2Address: CUSDC.l2Address,
		redeemTokenPortalL2Address: CUSDC.l2PortalAddress
	};

	await depositERC20(config, amount, 6);
}

export async function withdrawCUSDC(amount: number) {
	const config: TokenConfig =	{
		depositToken: CUSDC.l1Address,
		depositTokenPortal: CUSDC.l1PortalAddress,
		depositTokenL2Address: CUSDC.l2Address,
		depositTokenPortalL2Address: CUSDC.l2PortalAddress,
		redeemToken: USDC.l1Address,
		redeemTokenPortal: USDC.l1PortalAddress,
		redeemTokenL2Address: USDC.l2Address,
		redeemTokenPortalL2Address: USDC.l2PortalAddress
	};

	await depositERC20(config, amount);
}
