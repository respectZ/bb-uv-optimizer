export const BinRect = Object.freeze({
	fromCubes(cubes: Cube[], texture?: Texture): BinRect[] {
		return cubes.reduce((acc, cube) => {
			for (const face in cube.faces) {
				const cubeFace = cube.faces[face];
				const cubeData = CubeData.fromUV(cubeFace.uv);
				if (isEmptyFace(cubeFace)) {
					acc.push({
						uuid: cube.uuid,
						cubeData,
						face,
					});
					continue;
				}
				let imageData: ImageData | undefined = texture ? cubeData.getImageData(texture) : undefined;
				if (imageData && isEmptyImageData(imageData)) {
					imageData = undefined;
				}
				acc.push({
					uuid: cube.uuid,
					cubeData,
					face,
					imageData,
				});
			}
			return acc;
		}, [] as BinRect[]);
	},
});

export type BinRect = {
	uuid: string;
	cubeData: CubeData;
	face: string;
	imageData?: ImageData;
};

export class CubeData {
	readonly location: THREE.Vec2;
	readonly size: THREE.Vec2;
	readonly mirror?: "x" | "y" | "xy";
	constructor(location: THREE.Vec2, size: THREE.Vec2, flip?: "x" | "y" | "xy") {
		this.location = location;
		this.size = size;
		this.mirror = flip;
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
		return new CubeData(location, { x: w, y: h }, flip);
	}
	toUV(): [number, number, number, number] {
		const { x, y } = this.location;
		const w = this.size.x;
		const h = this.size.y;
		let uv: [number, number, number, number];
		switch (this.mirror) {
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
	flip(axis: "x" | "y" | "xy"): CubeData {
		let newMirror: "x" | "y" | "xy" | undefined;
		switch (this.mirror) {
			case "x":
				if (axis === "x") {
					newMirror = undefined;
				} else if (axis === "y") {
					newMirror = "xy";
				} else {
					newMirror = "y";
				}
				break;
			case "y":
				if (axis === "x") {
					newMirror = "xy";
				} else if (axis === "y") {
					newMirror = undefined;
				} else {
					newMirror = "x";
				}
				break;
			case "xy":
				if (axis === "x") {
					newMirror = "y";
				} else if (axis === "y") {
					newMirror = "x";
				} else {
					newMirror = undefined;
				}
				break;
			default:
				newMirror = axis;
		}
		return new CubeData(this.location, this.size, newMirror);
	}
	getImageData(texture: Texture): ImageData | undefined {
		const w = this.size.x;
		const h = this.size.y;
		if (w === 0 || h === 0) {
			return;
		}
		const img = texture.img;
		const sx = this.location.x;
		const sy = this.location.y;
		const sw = w;
		const sh = h;
		const canvas = document.createElement("canvas");
		canvas.width = sw;
		canvas.height = sh;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to get canvas context");
		}
		context.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
		return context.getImageData(0, 0, sw, sh);
	}
	clone(): CubeData {
		return new CubeData(
			{ x: this.location.x, y: this.location.y },
			{ x: this.size.x, y: this.size.y },
			this.mirror,
		);
	}
}

function isEmptyFace(face: CubeFace): boolean {
	const uv = face.uv;
	const width = Math.ceil(Math.abs(uv[2] - uv[0]));
	const height = Math.ceil(Math.abs(uv[3] - uv[1]));
	return width === 0 || height === 0;
}

function isEmptyImageData(imageData: ImageData): boolean {
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] !== 0) {
			return false;
		}
	}
	return true;
}
