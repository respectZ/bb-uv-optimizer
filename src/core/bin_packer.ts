import { Pow2Utils } from "./utils";

export class BinPacker {
	constructor(private cubes: Cube[]) {}
	pack(options: PackOptions, textures: Texture[] = []) {
		const { sort = true } = options;
		const rectangles: BinRect[] = this.cubes.reduce((acc, cube) => {
			for (const [face, cubeFace] of Object.entries(cube.faces)) {
				if (this.isEmptyCubeFace(cubeFace, textures)) {
					acc.push({
						width: -1,
						height: -1,
						uuid: cube.uuid,
						face,
						location: { x: 0, y: 0 },
						invertWidth: false,
						invertHeight: false,
					});
					continue;
				}
				const uv = cubeFace.uv;
				const width = Math.ceil(Math.abs(uv[2] - uv[0]));
				const height = Math.ceil(Math.abs(uv[3] - uv[1]));
				acc.push({
					width,
					height,
					uuid: cube.uuid,
					face,
					location: {
						x: uv[0],
						y: uv[1],
					},
					invertWidth: uv[2] < uv[0],
					invertHeight: uv[3] < uv[1],
				});
			}
			return acc;
		}, [] as BinRect[]);
		if (sort) {
			rectangles.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
		}
		switch (options.algorithm) {
			case "shelf":
				return this.shelfPack(options, rectangles);
			case "maxrects":
				return this.maxRectsPack(options, rectangles);
			default:
				throw new Error(`Unknown packing algorithm: ${options.algorithm}`);
		}
	}
	private isEmptyCubeFace(cubeFace: CubeFace, textures: Texture[]): boolean {
		const uv = cubeFace.uv;
		const width = Math.ceil(Math.abs(uv[2] - uv[0]));
		const height = Math.ceil(Math.abs(uv[3] - uv[1]));
		if (width === 0 || height === 0) {
			return true;
		}
		for (const texture of textures) {
			const img = texture.img;
			const scaleW = Project ? texture.width / Project.texture_width : 1;
			const scaleH = Project ? texture.height / Project.texture_height : 1;
			const tCanvas = document.createElement("canvas");
			const tContext = tCanvas.getContext("2d");
			if (!tContext) {
				continue;
			}
			tCanvas.width = width;
			tCanvas.height = height;
			tContext.drawImage(
				img,
				uv[0] * scaleW,
				uv[1] * scaleH,
				width * scaleW,
				height * scaleH,
				0,
				0,
				width,
				height,
			);
			const imageData = tContext.getImageData(0, 0, tCanvas.width, tCanvas.height);
			if (this.isTransparentImage(imageData)) {
				return true;
			}
		}
		return false;
	}
	private isTransparentImage(imageData: ImageData): boolean {
		const data = imageData.data;
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] !== 0) {
				return false;
			}
		}
		return true;
	}
	private shelfPack(options: PackOptions, rectangles: BinRect[]) {
		const { maxSize = 2048, padding = 0 } = options;
		const minRectWidth = Math.max(...rectangles.map((r) => r.width + padding));
		const minRectHeight = Math.max(...rectangles.map((r) => r.height + padding));

		const canditates: number[] = [];
		let w = Pow2Utils.nextPow(minRectWidth);
		while (w <= maxSize) {
			canditates.push(w);
			w <<= 1;
		}
		let best: PackResult | undefined = undefined;
		for (const candidateW of canditates) {
			const { placed, success, usedHeight } = this.shelfPackWithWidth(
				rectangles,
				candidateW,
				padding,
			);
			if (!success) {
				continue;
			}
			const heightNeeded = Math.max(usedHeight, minRectHeight);
			const heightPow2 = Pow2Utils.nextPow(heightNeeded);
			if (heightPow2 > maxSize) {
				continue;
			}
			const area = candidateW * heightPow2;
			const result: PackResult = {
				width: candidateW,
				height: heightPow2,
				placed,
				usedHeight,
			};
			if (!best) {
				best = result;
			} else {
				const bestArea = best.width * best.height;
				if (
					area < bestArea ||
					(area === bestArea &&
						(result.height < best.height ||
							(result.height === best.height && result.width < best.width)))
				) {
					best = result;
				}
			}
		}
		if (!best) {
			const totalWidth = rectangles.reduce((acc, r) => acc + r.width + padding, 0);
			const fallbackW = Pow2Utils.nextPow(totalWidth);
			const { placed, usedHeight, success } = this.shelfPackWithWidth(
				rectangles,
				fallbackW,
				padding,
			);
			const heightPow2 = Pow2Utils.nextPow(usedHeight);
			if (!success || heightPow2 > maxSize) {
				throw new Error("Could not pack rectangles within the given maxSize");
			}
			return {
				width: fallbackW,
				height: heightPow2,
				placed,
				usedHeight,
			};
		}
		return best;
	}
	private shelfPackWithWidth(
		rectangles: BinRect[],
		canvasWidth: number,
		padding: number,
	): { placed: PlacedRect[]; usedHeight: number; success: boolean } {
		const placed: PlacedRect[] = [];
		let curX = 0;
		let curY = 0;
		let shelfHeight = 0;
		for (const r of rectangles) {
			// TODO: Fix empty rectangles being placed incorrectly
			if (r.width === -1 && r.height === -1) {
				placed.push({
					...r,
					newLocation: { x: 0, y: 0 },
				});
			}
			const wWithPad = r.width + padding;
			const hWithPad = r.height + padding;
			if (wWithPad > canvasWidth) {
				return {
					placed,
					usedHeight: curY + shelfHeight,
					success: false,
				};
			}
			if (curX + wWithPad <= canvasWidth) {
				placed.push({
					...r,
					newLocation: {
						x: curX + padding,
						y: curY + padding,
					},
				});
				curX += wWithPad;
				shelfHeight = Math.max(shelfHeight, hWithPad);
			} else {
				curY += shelfHeight;
				curX = 0;
				shelfHeight = hWithPad;
				placed.push({
					...r,
					newLocation: {
						x: curX + padding,
						y: curY + padding,
					},
				});
				curX += wWithPad;
			}
		}
		return {
			placed,
			usedHeight: curY + shelfHeight,
			success: true,
		};
	}

	// MaxRects
	private maxRectsPack(options: PackOptions, rectangles: BinRect[]) {
		const { maxSize = 2048, padding = 0 } = options;
		const width = Pow2Utils.nextPow(Math.max(...rectangles.map((r) => r.width + padding)));
		const height = maxSize;
		const freeRects: FreeRect[] = [{ x: 0, y: 0, w: width, h: height }];
		const placed: PlacedRect[] = [];
		for (const r of rectangles) {
			const w = r.width + padding;
			const h = r.height + padding;
			let bestRect: FreeRect | null = null;
			let bestShortShide = Infinity;
			let bestLongSide = Infinity;
			for (const f of freeRects) {
				if (f.w >= w && f.h >= h) {
					const leftoverH = Math.abs(f.h - h);
					const leftoverW = Math.abs(f.w - w);
					const shortSide = Math.min(leftoverH, leftoverW);
					const longSide = Math.max(leftoverH, leftoverW);
					if (
						shortSide < bestShortShide ||
						(shortSide === bestShortShide && longSide < bestLongSide)
					) {
						bestRect = { ...f, w, h };
						bestShortShide = shortSide;
						bestLongSide = longSide;
					}
				}
			}
			if (!bestRect) {
				continue;
			}
			const p: PlacedRect = {
				...r,
				newLocation: { x: bestRect.x + padding, y: bestRect.y + padding },
			};
			placed.push(p);
			this.splitFreeRect(freeRects, p);
		}
		const usedHeight = Math.max(...placed.map((r) => r.newLocation.y + r.height));
		const finalH = Pow2Utils.nextPow(usedHeight);
		return {
			width,
			height: finalH,
			placed,
			usedHeight,
		};
	}
	private splitFreeRect(freeRects: FreeRect[], placedRect: PlacedRect) {
		const newFreeRects: FreeRect[] = [];
		for (const f of freeRects) {
			if (
				placedRect.newLocation.x >= f.x + f.w ||
				placedRect.newLocation.x + placedRect.width <= f.x ||
				placedRect.newLocation.y >= f.y + f.h ||
				placedRect.newLocation.y + placedRect.height <= f.y
			) {
				newFreeRects.push(f);
				continue;
			}
			if (placedRect.newLocation.x > f.x) {
				newFreeRects.push({
					x: f.x,
					y: f.y,
					w: placedRect.newLocation.x - f.x,
					h: f.h,
				});
			}
			if (placedRect.newLocation.x + placedRect.width < f.x + f.w) {
				newFreeRects.push({
					x: placedRect.newLocation.x + placedRect.width,
					y: f.y,
					w: f.x + f.w - (placedRect.newLocation.x + placedRect.width),
					h: f.h,
				});
			}
			if (placedRect.newLocation.y > f.y) {
				newFreeRects.push({
					x: f.x,
					y: f.y,
					w: f.w,
					h: placedRect.newLocation.y - f.y,
				});
			}
			if (placedRect.newLocation.y + placedRect.height < f.y + f.h) {
				newFreeRects.push({
					x: f.x,
					y: placedRect.newLocation.y + placedRect.height,
					w: f.w,
					h: f.y + f.h - (placedRect.newLocation.y + placedRect.height),
				});
			}
		}
		freeRects.length = 0;
		freeRects.push(...newFreeRects);
	}
}

type FreeRect = { x: number; y: number; w: number; h: number };

export type BinRect = {
	width: number;
	height: number;
	uuid: string;
	face: string;
	location: THREE.Vec2;
	invertWidth: boolean;
	invertHeight: boolean;
};

export type PlacedRect = BinRect & {
	newLocation: THREE.Vec2;
};

export type PackOptions = {
	algorithm: "shelf" | "maxrects";
	maxSize?: number;
	padding?: number;
	sort?: boolean;
};

export type PackResult = {
	width: number;
	height: number;
	placed: PlacedRect[];
	usedHeight: number;
};
