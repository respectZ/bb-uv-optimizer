import { BinRect, type CubeData } from "./bin_rect";
import { SkylineBinPacker } from "./skyline";

export class BinPacker {
	private rects: BinRect[] = [];
	constructor(cubes: Cube[], texture?: Texture) {
		this.rects = BinRect.fromCubes(cubes, texture);
	}
	pack(options: PackOptions): PackResult {
		const { algorithm } = options;
		switch (algorithm) {
			case "skyline": {
				const packer = new SkylineBinPacker(options);
				return packer.pack(this.rects);
			}
		}
	}
	exportTexture(result: PackResult, texture: Texture, options: ExportTextureOptions = {}): Texture {
		const { rects } = result;
		let w = result.w;
		let h = result.h;
		const { maxHeight, maxWidth } = options;
		const wFrames = Math.ceil(texture.width / (Project?.texture_width ?? 1));
		const hFrames = Math.ceil(texture.height / (Project?.texture_height ?? 1));
		if (maxWidth !== undefined) {
			w = Math.min(w, maxWidth);
		}
		if (maxHeight !== undefined) {
			h = Math.min(h, maxHeight);
		}
		w *= wFrames;
		h *= hFrames;
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}
		for (const r of rects) {
			const cloneData = r.cubeData.clone();
			const x = cloneData.location.x;
			const y = cloneData.location.y;
			for (let i = 0; i < wFrames; i++) {
				for (let j = 0; j < hFrames; j++) {
					if (!r.imageData) {
						continue;
					}
					const yOffset = j * (h / hFrames);
					const xOffset = i * (w / wFrames);
					// cloneData.location.x = x + xOffset;
					// cloneData.location.y = y + yOffset;
					console.log(j * (texture.height / hFrames));
					cloneData.location.x = x + i * (texture.width / wFrames);
					cloneData.location.y = y + j * (texture.height / hFrames);
					const imageData = cloneData.getImageData(texture);
					if (!imageData) {
						continue;
					}
					const rx = r.placed.location.x + xOffset;
					const ry = r.placed.location.y + yOffset;
					context.putImageData(imageData, rx, ry);
				}
			}
		}
		let name = texture.name.split(".").slice(0, -1).join(".");
		const extension = texture.name.split(".").pop() ?? "png";
		if (name === "") {
			name = "texture";
		}
		name += `_optimized.${extension}`;
		const retval = new Texture({
			name,
			width: w,
			height: h,
		});
		retval.fromDataURL(canvas.toDataURL());
		return retval;
	}
}

export type PackOptions = {
	algorithm: "skyline";
	maxSize: number;
	padding: number;
	similarCheck: boolean;
	similarityThreshold: number;
};

export type PackResult = {
	rects: PackedRect[];
	w: number;
	h: number;
};

export type PackedRect = BinRect & {
	placed: CubeData;
};

export type ExportTextureOptions = {
	maxWidth?: number;
	maxHeight?: number;
};
