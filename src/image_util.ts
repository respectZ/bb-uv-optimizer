export class ImageUtil {
	static isSameImageData(data1: ImageData, data2: ImageData, threshold = 90): boolean {
		if (data1.width !== data2.width || data1.height !== data2.height) {
			return false;
		}
		const similarity = this.calculateSimilarity(data1, data2);
		return similarity >= threshold;
	}
	static isMirroredImageData(
		data1: ImageData,
		data2: ImageData,
		threshold = 90,
	): "x" | "y" | "xy" | undefined {
		if (data1.width !== data2.width || data1.height !== data2.height) {
			return undefined;
		}
		const width = data1.width;
		const height = data1.height;
		const data1Array = data1.data;
		const data2Array = data2.data;
		const totalPixels = width * height;
		const maxDifferentPixels = Math.floor(totalPixels * (1 - threshold / 100));
		let xMatches = 0;
		let yMatches = 0;
		let xyMatches = 0;
		const xFailThreshold = totalPixels - maxDifferentPixels;
		const yFailThreshold = totalPixels - maxDifferentPixels;
		const xyFailThreshold = totalPixels - maxDifferentPixels;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const sourceIdx = (y * width + x) * 4;
				const xFlippedIdx = (y * width + (width - 1 - x)) * 4;
				const yFlippedIdx = ((height - 1 - y) * width + x) * 4;
				const xyFlippedIdx = ((height - 1 - y) * width + (width - 1 - x)) * 4;
				let isXMatch = true;
				let isYMatch = true;
				let isXYMatch = true;
				for (let c = 0; c < 4; c++) {
					if (!this.isSamePixel(data1Array, data2Array, sourceIdx, xFlippedIdx, 1)) {
						isXMatch = false;
					}
					if (!this.isSamePixel(data1Array, data2Array, sourceIdx, yFlippedIdx, 1)) {
						isYMatch = false;
					}
					if (!this.isSamePixel(data1Array, data2Array, sourceIdx, xyFlippedIdx, 1)) {
						isXYMatch = false;
					}
					if (!isXMatch && !isYMatch && !isXYMatch) {
						break;
					}
				}
				if (isXMatch) {
					xMatches++;
				}
				if (isYMatch) {
					yMatches++;
				}
				if (isXYMatch) {
					xyMatches++;
				}
				const remainingPixels = totalPixels - (y * width + x + 1);
				if (
					xMatches + remainingPixels < xFailThreshold &&
					yMatches + remainingPixels < yFailThreshold &&
					xyMatches + remainingPixels < xyFailThreshold
				) {
					return undefined;
				}
			}
		}
		const xSimilarity = (xMatches / totalPixels) * 100;
		const ySimilarity = (yMatches / totalPixels) * 100;
		const xySimilarity = (xyMatches / totalPixels) * 100;
		const results: { axis: "x" | "y" | "xy"; similarity: number }[] = [];
		if (xSimilarity >= threshold) {
			results.push({ axis: "x", similarity: xSimilarity });
		}
		if (ySimilarity >= threshold) {
			results.push({ axis: "y", similarity: ySimilarity });
		}
		if (xySimilarity >= threshold) {
			results.push({ axis: "xy", similarity: xySimilarity });
		}
		if (results.length === 0) {
			return undefined;
		}
		results.sort((a, b) => b.similarity - a.similarity);
		return results[0].axis;
	}
	private static isSamePixel(
		data1Array: Uint8ClampedArray,
		data2Array: Uint8ClampedArray,
		idx1: number,
		idx2: number,
		colorThreshold = 0,
	) {
		for (let c = 0; c < 4; c++) {
			if (Math.abs(data1Array[idx1 + c] - data2Array[idx2 + c]) > colorThreshold) {
				return false;
			}
		}
		return true;
	}
	private static calculateSimilarity(
		data1: ImageData,
		data2: ImageData,
		ignoreAlpha: boolean = false,
	): number {
		if (data1.width !== data2.width || data1.height !== data2.height) {
			return 0;
		}
		const totalPixels = data1.width * data1.height;
		let matchingPixels = 0;
		const data1Array = data1.data;
		const data2Array = data2.data;
		for (let i = 0; i < data1Array.length; i += 4) {
			let isMatching = true;
			for (let c = 0; c < 4; c++) {
				if (ignoreAlpha && c === 3) {
					continue;
				}
				if (data1Array[i + c] !== data2Array[i + c]) {
					isMatching = false;
					break;
				}
			}
			if (isMatching) {
				matchingPixels++;
			}
		}
		return (matchingPixels / totalPixels) * 100;
	}
}
