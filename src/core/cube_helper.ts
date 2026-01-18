export const CubeHelper = Object.freeze({
	isEmptyFace(cubeFace: CubeFace) {
		const uv = cubeFace.uv;
		const width = Math.ceil(Math.abs(uv[2] - uv[0]));
		const height = Math.ceil(Math.abs(uv[3] - uv[1]));
		if (width === 0 || height === 0) {
			return true;
		}
	},
});

export class CubeData {
	readonly location: THREE.Vec2;
	readonly w: number;
	readonly h: number;
	readonly flip?: "x" | "y" | "xy";
	constructor(location: THREE.Vec2, w: number, h: number, flip?: "x" | "y" | "xy") {
		this.location = location;
		this.w = w;
		this.h = h;
		this.flip = flip;
	}
	static fromUV(uv: [number, number, number, number]): CubeData {
		const w = Math.ceil(Math.abs(uv[2] - uv[0]));
		const h = Math.ceil(Math.abs(uv[3] - uv[1]));
		const location: THREE.Vec2 = {
			x: Math.min(uv[0], uv[2]),
			y: Math.min(uv[1], uv[3]),
		};
		const flipX = uv[0] > uv[2];
		const flipY = uv[1] > uv[3];
		let flip: "x" | "y" | "xy" | undefined = undefined;
		if (flipX && flipY) {
			flip = "xy";
		} else if (flipX) {
			flip = "x";
		} else if (flipY) {
			flip = "y";
		}
		return new CubeData(location, w, h, flip);
	}
	toUV(): [number, number, number, number] {
		const { x, y } = this.location;
		const w = this.w;
		const h = this.h;
		let uv: [number, number, number, number];
		switch (this.flip) {
			case "xy":
				uv = [x + w, y + h, x, y];
				break;
			case "x":
				uv = [x + w, y, x, y + h];
				break;
			case "y":
				uv = [x, y + h, x + w, y];
				break;
			default:
				uv = [x, y, x + w, y + h];
		}
		return uv;
	}
	getImageData(texture: Texture): ImageData | undefined {
		if (this.w === 0 || this.h === 0) {
			return;
		}
		const img = texture.img;
		const scaleW = Project ? texture.width / Project.texture_width : 1;
		const scaleH = Project ? texture.height / Project.texture_height : 1;
		const sx = this.location.x * scaleW;
		const sy = this.location.y * scaleH;
		const sw = this.w * scaleW;
		const sh = this.h * scaleH;
		const canvas = document.createElement("canvas");
		canvas.width = this.w;
		canvas.height = this.h;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}
		ctx.drawImage(img, sx, sy, sw, sh, 0, 0, this.w, this.h);
		const imageData = ctx.getImageData(0, 0, this.w, this.h);
		return imageData;
	}
}
