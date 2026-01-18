export function nextPowerOfTwo(n: number): number {
	return 1 << Math.ceil(Math.log2(n));
}

export function isSameImageData(data1: ImageData, data2: ImageData): boolean {
	if (data1.width !== data2.width || data1.height !== data2.height) {
		return false;
	}
	const d1 = data1.data;
	const d2 = data2.data;
	for (let i = 0; i < d1.length; i++) {
		if (d1[i] !== d2[i]) {
			return false;
		}
	}
	return true;
}

export function isMirroredImageData(
	data1: ImageData,
	data2: ImageData,
): "x" | "y" | "xy" | undefined {
	if (data1.width !== data2.width || data1.height !== data2.height) {
		return undefined;
	}
	const width = data1.width;
	const height = data1.height;
	const data1Array = data1.data;
	const data2Array = data2.data;
	let isMirroredX = true;
	let isMirroredY = true;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const sourceIdx = (y * width + x) * 4;
			const xFlippedIdx = (y * width + (width - 1 - x)) * 4;
			const yFlippedIdx = ((height - 1 - y) * width + x) * 4;
			if (isMirroredX) {
				for (let c = 0; c < 4; c++) {
					if (data1Array[sourceIdx + c] !== data2Array[xFlippedIdx + c]) {
						isMirroredX = false;
						break;
					}
				}
			}
			if (isMirroredY) {
				for (let c = 0; c < 4; c++) {
					if (data1Array[sourceIdx + c] !== data2Array[yFlippedIdx + c]) {
						isMirroredY = false;
						break;
					}
				}
			}
			if (!isMirroredX && !isMirroredY) {
				break;
			}
		}
		if (!isMirroredX && !isMirroredY) {
			break;
		}
	}
	if (isMirroredX && isMirroredY) {
		return "xy";
	} else if (isMirroredX) {
		return "x";
	} else if (isMirroredY) {
		return "y";
	}
	return undefined;
}
