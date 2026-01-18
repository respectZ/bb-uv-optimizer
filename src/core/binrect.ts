import { CubeData, CubeHelper } from "./cube_helper";
import { ImageDataHelper } from "./imagedata_helper";

export const BinRect = Object.freeze({
	fromCubes: (cubes: Cube[], texture?: Texture): BinRect[] => {
		return cubes.reduce((acc, cube) => {
			for (const face in cube.faces) {
				const cubeFace = cube.faces[face];
				const cubeData = CubeData.fromUV(cubeFace.uv);
				if (CubeHelper.isEmptyFace(cubeFace)) {
					acc.push({
						uuid: cube.uuid,
						cubeData,
						face,
					});
					continue;
				}
				let imageData: ImageData | undefined = texture ? cubeData.getImageData(texture) : undefined;
				if (imageData && ImageDataHelper.isEmpty(imageData)) {
					imageData = undefined;
				}
				if (cube.name === "err" && face === "east") {
					console.log("BinRect fromCubes", cube.name, face, cubeData, imageData, cube.uuid);
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
	cubeData: CubeData;
	uuid: string;
	face: string;
	imageData?: ImageData;
};

export type BinRectOptions = {
	texture?: Texture;
};
