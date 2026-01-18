import { BinRect } from "./binrect";
import type { CubeData } from "./cube_helper";
import { MaxRectsPacker } from "./max_rects_packer";
import { ShelfPacker } from "./shelf_packer";

export class BinPacker {
	private rects: BinRect[] = [];
	constructor(cubes: Cube[], texture?: Texture) {
		this.rects = BinRect.fromCubes(cubes, texture);
	}
	pack(options: PackOptions): PackResult {
		const rects = this.rects.slice();
		const { algorithm, sort } = options;
		if (sort) {
			rects.sort((a, b) => {
				return a.cubeData.w * a.cubeData.h - b.cubeData.w * b.cubeData.h;
			});
		}
		switch (algorithm) {
			case "shelf":
				return ShelfPacker.pack(rects, options);
			case "maxrects":
				return MaxRectsPacker.pack(rects, options);
			default:
				throw new Error(`Unknown packing algorithm: ${algorithm}`);
		}
	}
	exportTexture(result: PackResult, texture: Texture): Texture {
		const { w, h, rects } = result;
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}
		for (const r of rects) {
			if (!r.imageData) {
				continue;
			}
			const imageData = r.cubeData.getImageData(texture);
			if (!imageData) {
				continue;
			}
			const rx = r.placed.location.x;
			const ry = r.placed.location.y;
			context.putImageData(imageData, rx, ry);
			console.log("Draw image data at", rx, ry, "size", imageData.width, imageData.height);
		}
		let name = texture.name.split(".").slice(0, -1).join(".");
		if (name === "") {
			name = "texture";
		}
		// TODO: TGA
		name += "_optimized.png";
		const textureResult = new Texture({
			name,
			width: w,
			height: h,
		});
		textureResult.fromDataURL(canvas.toDataURL());
		return textureResult;
	}
}

export type PackOptions = {
	algorithm: "shelf" | "maxrects";
	maxSize: number;
	padding: number;
	sort: boolean;
	// TODO: Implement rotation support.
	rotate: boolean;
};

export type PackedRect = BinRect & {
	placed: CubeData;
};

export type PackResult = {
	w: number;
	h: number;
	rects: PackedRect[];
};
