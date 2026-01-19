import type { PackedRect, PackOptions, PackResult } from "./bin_packer";
import { CubeData, type BinRect } from "./bin_rect";
import { ImageUtil } from "./image_util";
import { nextPowerOfTwo } from "./util";

type SkylineNode = {
	x: number;
	y: number;
	w: number;
};

export class SkylineBinPacker {
	private w: number;
	private h: number;
	private maxW: number;
	private maxH: number;
	private padding: number;
	private skyline: SkylineNode[];
	private similarCheck: boolean;
	private similarityThreshold: number;
	constructor(options: PackOptions) {
		this.w = nextPowerOfTwo(options.maxSize >> 1);
		this.h = nextPowerOfTwo(options.maxSize >> 1);
		this.maxW = options.maxSize;
		this.maxH = options.maxSize;
		this.padding = options.padding;
		this.similarCheck = options.similarCheck;
		this.similarityThreshold = options.similarityThreshold;
		this.skyline = [{ x: 0, y: 0, w: this.w }];
	}
	pack(rects: BinRect[]): PackResult {
		const sorted = rects.slice().sort((a, b) => {
			return b.cubeData.size.y - a.cubeData.size.y;
		});
		const packedRects: PackedRect[] = [];
		let emptyRects: PackedRect[] = [];
		for (const rect of sorted) {
			// Empty pixels
			if (rect.imageData === undefined) {
				emptyRects.push({
					...rect,
					placed: CubeData.fromUV([0, 0, 0, 0]),
				});
				continue;
			}
			// Similar check.
			if (this.similarCheck) {
				const current = rect.imageData;
				let found = false;
				for (const r of packedRects) {
					if (!r.imageData) {
						continue;
					}
					if (ImageUtil.isSameImageData(current, r.imageData, this.similarityThreshold)) {
						let placed = r.placed;
						if (rect.cubeData.mirror) {
							placed = placed.flip(rect.cubeData.mirror);
						}
						packedRects.push({
							...rect,
							placed,
							imageData: undefined,
						});
						found = true;
						break;
					}
					const mirroredAxis = ImageUtil.isMirroredImageData(
						current,
						r.imageData,
						this.similarityThreshold,
					);
					if (mirroredAxis) {
						packedRects.push({
							...rect,
							placed: r.placed.flip(mirroredAxis),
							imageData: undefined,
						});
						found = true;
						break;
					}
				}
				if (found) {
					continue;
				}
			}
			const w = rect.cubeData.size.x + this.padding * 2;
			const h = rect.cubeData.size.y + this.padding * 2;
			let pos = this.findPosition(w, h);
			while (!pos && this.w < this.maxW && this.h < this.maxH) {
				const oldW = this.w;
				const oldH = this.h;
				this.grow();
				pos = this.findPosition(w, h);
				if (this.w === oldW && this.h === oldH && !pos) {
					// Unable to grow further
					break;
				}
			}
			if (!pos) {
				throw new Error("Insufficient space to pack all rectangles.");
			}
			this.addSkyline(pos.index, pos.x, pos.y, w, h);
			packedRects.push({
				...rect,
				placed: CubeData.fromUV([
					pos.x + this.padding,
					pos.y + this.padding,
					pos.x + this.padding + rect.cubeData.size.x,
					pos.y + this.padding + rect.cubeData.size.y,
				]),
			});
		}
		let emptyPixel = this.getFirstEmptyPixel();
		if (!emptyPixel) {
			emptyPixel = { x: 0, y: 0 };
		}
		emptyRects = emptyRects.map((rect) => ({
			...rect,
			placed: CubeData.fromUV([emptyPixel.x, emptyPixel.y, emptyPixel.x + 1, emptyPixel.y + 1]),
		}));
		packedRects.push(...emptyRects);
		return {
			rects: packedRects,
			w: this.w,
			h: this.h,
		};
	}
	getFirstEmptyPixel(): { x: number; y: number } | undefined {
		for (let y = 0; y < this.h; y++) {
			for (let x = 0; x < this.w; x++) {
				let isFilled = false;
				for (const node of this.skyline) {
					if (x >= node.x && x < node.x + node.w && y < node.y) {
						isFilled = true;
						break;
					}
				}
				if (!isFilled) {
					return { x, y };
				}
			}
		}
		return undefined;
	}
	private findPosition(w: number, h: number) {
		let bestY = Infinity;
		let bestX = 0;
		let bestIndex = -1;
		for (let i = 0; i < this.skyline.length; i++) {
			const y = this.canFit(i, w, h);
			if (y >= 0 && y + h < this.h) {
				if (y < bestY || (y === bestY && this.skyline[i].x < bestX)) {
					bestY = y;
					bestX = this.skyline[i].x;
					bestIndex = i;
				}
			}
		}
		if (bestIndex === -1) {
			return;
		}
		return {
			x: bestX,
			y: bestY,
			index: bestIndex,
		};
	}
	private canFit(index: number, w: number, h: number) {
		const x = this.skyline[index].x;
		let y = this.skyline[index].y;
		let wLeft = w;
		let i = index;
		if (x + w > this.w) {
			return -1;
		}
		while (wLeft > 0) {
			if (i >= this.skyline.length) {
				return -1;
			}
			y = Math.max(y, this.skyline[i].y);
			if (y + h > this.h) {
				return -1;
			}
			wLeft -= this.skyline[i].w;
			i++;
		}
		return y;
	}
	private addSkyline(index: number, x: number, y: number, w: number, h: number) {
		const newNode: SkylineNode = {
			x,
			y: y + h,
			w,
		};
		this.skyline.splice(index, 0, newNode);
		// Remove overlapping nodes
		for (let i = index + 1; i < this.skyline.length; i++) {
			const node = this.skyline[i];
			const overlap = newNode.x + newNode.w - node.x;
			if (overlap <= 0) {
				break;
			}
			if (node.w <= overlap) {
				this.skyline.splice(i, 1);
				i--;
			} else {
				node.x += overlap;
				node.w -= overlap;
				break;
			}
		}
		this.mergeSkylines();
	}
	private mergeSkylines() {
		for (let i = 0; i < this.skyline.length - 1; i++) {
			if (this.skyline[i].y === this.skyline[i + 1].y) {
				this.skyline[i].w += this.skyline[i + 1].w;
				this.skyline.splice(i + 1, 1);
				i--;
			}
		}
	}
	private grow() {
		if (this.h < this.maxH) {
			this.expandHeight();
		} else if (this.w < this.maxW) {
			this.expandWidth();
		}
	}
	private expandWidth() {
		const oldW = this.w;
		this.w <<= 1;
		this.skyline.push({
			x: oldW,
			y: 0,
			w: this.w - oldW,
		});
	}
	private expandHeight() {
		this.h <<= 1;
	}
}
