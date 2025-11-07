import type { PackResult, PlacedRect } from "./bin_packer";
import { uuidV4 } from "./utils";

export function createTextures(result: PackResult, baseTextures: Texture[]) {
	const scaleW = Project ? baseTextures[0].width / Project.texture_width : 1;
	const scaleH = Project ? baseTextures[0].height / Project.texture_height : 1;
	const rect = result.placed;
	const { width, height } = result;
	return baseTextures.map((baseTexture) =>
		createTexture({ rect, baseTexture, scaleW, scaleH, width, height }),
	);
}

function createTexture(arg: CreateTextureArg) {
	const { rect, baseTexture, scaleW, scaleH, height, width } = arg;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Failed to get canvas context");
	}
	const img = baseTexture.img;
	for (const r of rect) {
		const tCanvas = document.createElement("canvas");
		tCanvas.width = Math.abs(r.width);
		tCanvas.height = Math.abs(r.height);
		if (r.width === 0 || r.height === 0) {
			continue;
		}
		// Transparent from packer.
		if (r.width === -1 && r.height === -1) {
			continue;
		}
		const tContext = tCanvas.getContext("2d");
		if (!tContext) {
			throw new Error("Failed to get source canvas context");
		}
		tContext.drawImage(
			img,
			(r.location.x - (r.invertWidth ? r.width : 0)) * scaleW,
			(r.location.y - (r.invertHeight ? r.height : 0)) * scaleH,
			r.width * scaleW,
			r.height * scaleH,
			0,
			0,
			r.width,
			r.height,
		);
		const imageData = tContext.getImageData(0, 0, tCanvas.width, tCanvas.height);
		if (isTransparent(imageData)) {
			r.width = -1;
			r.height = -1;
			continue;
		}
		context.drawImage(tCanvas, r.newLocation.x, r.newLocation.y);
	}
	let name = baseTexture.name.split(".").slice(0, -1).join(".");
	if (name === "") {
		name = "texture";
	}
	// TODO: TGA
	name += "_optimized.png";
	const texture = new Texture({
		name,
		width: canvas.width,
		height: canvas.height,
		uuid: uuidV4(),
	});
	texture.width = canvas.width;
	texture.height = canvas.height;
	texture.fromDataURL(canvas.toDataURL());
	return texture;
}
// Check if image data is fully transparent
function isTransparent(imageData: ImageData): boolean {
	const data = imageData.data;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] !== 0) {
			return false;
		}
	}
	return true;
}

type CreateTextureArg = {
	rect: PlacedRect[];
	baseTexture: Texture;
	scaleW: number;
	scaleH: number;
	width: number;
	height: number;
};
