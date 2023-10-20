export function shorterHash(hash: string) {
	if (!hash) return;
	return hash.slice(0, 6) + "..." + hash.slice(hash.length - 4, hash.length);
}
