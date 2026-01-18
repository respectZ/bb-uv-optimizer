import type { PackedRect, PackOptions, PackResult } from "./binpacker_v2";
import type { BinRect } from "./binrect";
import { CubeData } from "./cube_helper";
import { Pow2Utils } from "./utils";

export class ShelfPacker {
	static pack(rects: BinRect[], options: PackOptions): PackResult {
		const { maxSize, padding } = options;
		const minRectWidth = Math.max(...rects.map((r) => r.cubeData.w + padding));
		const minRectHeight = Math.max(...rects.map((r) => r.cubeData.h + padding));
		const candidates: number[] = [];
		let w = Pow2Utils.nextPow(minRectWidth);
		while (w <= maxSize) {
			candidates.push(w);
			w <<= 1;
		}
		let best: PackResult | undefined = undefined;
		for (const candidateW of candidates) {
			const { placed, success, usedHeight } = this.packWidth(rects, candidateW, padding);
			if (!success) {
				console.log("Failed packWidth", candidateW);
				continue;
			}
			console.log("successful packWidth", candidateW, usedHeight);
			const heightNeeded = Math.max(usedHeight, minRectHeight);
			const heightPow2 = Pow2Utils.nextPow(heightNeeded);
			if (heightPow2 > maxSize) {
				continue;
			}
			const area = candidateW * heightPow2;
			const result: PackResult = {
				w: candidateW,
				h: heightPow2,
				rects: placed,
			};
			if (!best) {
				best = result;
			} else {
				const bestArea = best.w * best.h;
				if (
					area < bestArea ||
					(area === bestArea && (result.h < best.h || (result.h === best.h && result.w < best.w)))
				) {
					best = result;
				}
			}
		}
		if (!best) {
			const totalWidth = rects.reduce((acc, r) => acc + r.cubeData.w + padding, 0);
			const fallbackW = Pow2Utils.nextPow(totalWidth);
			const { placed, usedHeight, success } = this.packWidth(rects, fallbackW, padding);
			const heightPow2 = Pow2Utils.nextPow(usedHeight);
			if (!success || heightPow2 > maxSize) {
				throw new Error("Failed to pack rectangles with shelf algorithm.");
			}
			return {
				w: fallbackW,
				h: heightPow2,
				rects: placed,
			};
		}
		console.log("Best shelf pack", best.w, best.h);
		return best;
	}
	private static packWidth(
		rects: BinRect[],
		canvasWidth: number,
		padding: number,
	): PackWidthResult {
		const placed: PackedRect[] = [];
		let curX = 0;
		let curY = 0;
		let shelfHeight = 0;
		for (const r of rects) {
			// Empty pixels
			if (r.imageData === undefined) {
				placed.push({
					...r,
					placed: CubeData.fromUV([0, 0, 0, 0]),
				});
				continue;
			}
			const data = r.cubeData;
			const wPadded = data.w + padding;
			const hPadded = data.h + padding;
			if (wPadded > canvasWidth) {
				return {
					placed,
					usedHeight: curY + shelfHeight,
					success: false,
				};
			}
			if (curX + wPadded <= canvasWidth) {
				placed.push({
					...r,
					placed: CubeData.fromUV([curX, curY, curX + data.w, curY + data.h]),
				});
				curX += wPadded;
				shelfHeight = Math.max(shelfHeight, hPadded);
			} else {
				curY += shelfHeight;
				curX = 0;
				shelfHeight = hPadded;
				placed.push({
					...r,
					placed: CubeData.fromUV([curX, curY, curX + data.w, curY + data.h]),
				});
				curX += wPadded;
			}
		}
		return {
			placed,
			usedHeight: curY + shelfHeight,
			success: true,
		};
	}
}

type PackWidthResult = {
	placed: PackedRect[];
	usedHeight: number;
	success: boolean;
};
