export const ImageDataHelper = Object.freeze({
	isEmpty(imageData: ImageData): boolean {
		const data = imageData.data;
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] !== 0) {
				return false;
			}
		}
		return true;
	},
});
