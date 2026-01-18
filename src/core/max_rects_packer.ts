import type { PackedRect, PackOptions, PackResult } from "./binpacker_v2";
import type { BinRect } from "./binrect";
import { CubeData } from "./cube_helper";
import { Pow2Utils } from "./utils";

export class MaxRectsPacker {
	static pack(rects: BinRect[], options: PackOptions): PackResult {
		const { maxSize, padding } = options;
		const width = Pow2Utils.nextPow(Math.max(...rects.map((r) => r.cubeData.w + padding)));
		// const height = Pow2Utils.nextPow(Math.max(...rects.map((r) => r.cubeData.h + padding)));
		const height = maxSize;
		const freeRects: FreeRect[] = [
			{ x: 0, y: 0, w: width, h: height },
		];
		const placed: PackedRect[] = [];
		// TODO: Handle empty pixels
		for (const r of rects) {
			// Empty pixels
			if (r.imageData === undefined) {
				placed.push({
					...r,
					placed: CubeData.fromUV([0, 0, 0, 0]),
				});
				continue;
			}
			const w = r.cubeData.w;
			const h = r.cubeData.h;
			const wPadded = w + padding;
			const hPadded = h + padding;
			let bestRect: FreeRect | undefined;
			let bsetShortShide = Infinity;
			let bestLongSide = Infinity;
			for (const f of freeRects) {
				if (f.w >= wPadded && f.h >= hPadded) {
					const leftoverH = Math.abs(f.h - hPadded);
					const leftoverW = Math.abs(f.w - wPadded);
					const shortSide = Math.min(leftoverH, leftoverW);
					const longSide = Math.max(leftoverH, leftoverW);
					if (
						shortSide < bsetShortShide ||
						(shortSide === bsetShortShide && longSide < bestLongSide)
					) {
						bestRect = f;
						bsetShortShide = shortSide;
						bestLongSide = longSide;
					}
				}
			}
			if (!bestRect) {
				throw new Error("Failed to pack rectangles within max size with maxrects algorithm.");
			}
			const placedData = CubeData.fromUV([bestRect.x, bestRect.y, bestRect.x + w, bestRect.y + h]);
			const placedRect: PackedRect = {
				...r,
				placed: placedData,
			};
			placed.push(placedRect);
			this.splitFreeRect(freeRects, placedRect);
		}
		const usedWidth = Math.max(...placed.map((p) => p.placed.location.x + p.placed.w));
		const usedHeight = Math.max(...placed.map((p) => p.placed.location.y + p.placed.h));
		const packedW = Pow2Utils.nextPow(usedWidth);
		const packedH = Pow2Utils.nextPow(usedHeight);
		if (packedW > maxSize || packedH > maxSize) {
			throw new Error("Failed to pack rectangles within max size with maxrects algorithm.");
		}
		return {
			w: packedW,
			h: packedH,
			rects: placed,
		};
	}
	private static splitFreeRect(freeRects: FreeRect[], placedRect: PackedRect) {
		const toAdd: FreeRect[] = [];
		const px = placedRect.placed.location.x;
		const py = placedRect.placed.location.y;
		const pw = placedRect.placed.w;
		const ph = placedRect.placed.h;
		for (const f of freeRects) {
			if (px >= f.x + f.w || px + pw <= f.x || py >= f.y + f.h || py + ph <= f.y) {
				toAdd.push(f);
				continue;
			}
			if (px > f.x) {
				toAdd.push({
					x: f.x,
					y: f.y,
					w: px - f.x,
					h: f.h,
				});
			}
			if (px + pw < f.x + f.w) {
				toAdd.push({
					x: px + pw,
					y: f.y,
					w: f.x + f.w - (px + pw),
					h: f.h,
				});
			}
			if (py > f.y) {
				toAdd.push({
					x: f.x,
					y: f.y,
					w: f.w,
					h: py - f.y,
				});
			}
			if (py + ph < f.y + f.h) {
				toAdd.push({
					x: f.x,
					y: py + ph,
					w: f.w,
					h: f.y + f.h - (py + ph),
				});
			}
		}
		freeRects.length = 0;
		freeRects.push(...toAdd);
	}
}

type FreeRect = {
	x: number;
	y: number;
	w: number;
	h: number;
};
