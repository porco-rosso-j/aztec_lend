export async function getBalances(): Promise<any> {
	const tokenBalances = {
		DAI: 10000e18,
		SDAI: 1000e18,
		USDC: 200e6,
		CUSDC: 200e6,
	};
	return tokenBalances;
}
