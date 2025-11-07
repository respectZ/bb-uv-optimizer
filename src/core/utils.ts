export class Pow2Utils {
	static nextPow(v: number): number {
		if (v <= 1) {
			return 1;
		}
		return 1 << Math.ceil(Math.log2(v));
	}
	static isPow2(v: number): boolean {
		return (v & (v - 1)) === 0 && v !== 0;
	}
}

export function uuidV4(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
