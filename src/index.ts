/// <reference types="blockbench-types"/>
import { BinPacker, type PackOptions, type PackResult } from "./bin_packer";

class BBUVOptimizerPlugin implements PluginOptions {
	readonly id = "moe.svdex.bb_uv_optimizer";
	readonly title = "UV Optimizer";
	author = "Svdex";
	description = "Automatically optimize UV layouts to reduce texture space usage.";
	icon = "resize";
	variant: "both" | "desktop" | "web" = "both";
	version = "[[VERSION]]";
	action?: Action;
	constructor() {
		this.onload = this.onload.bind(this);
		this.onunload = this.onunload.bind(this);
	}
	onload(): void {
		this.action = new Action(this.id + ".action", {
			icon: "resize",
			name: "Optimize UV and Textures",
			condition: () => Format.id === "bedrock",
			click: () => this.showDialog(),
		});
	}
	onunload(): void {
		this.action?.delete();
	}
	private showDialog(): void {
		const cubes = Cube.all;
		if (cubes.length === 0) {
			Blockbench.showQuickMessage("No cubes available.", 2000);
			return;
		}
		if (Texture.all.length === 0) {
			Blockbench.showQuickMessage("No textures available to optimize.", 2000);
			return;
		}
		const textures = Texture.all.reduce(
			(acc, texture) => {
				acc["_tex." + texture.uuid] = {
					type: "checkbox",
					label: texture.name,
					value: !texture.name.includes("_optimized"),
				};
				acc["preview." + texture.uuid] = {
					type: "info",
					text: `<img src="${texture.canvas.toDataURL()}" width="48px" alt class="texture_icon">`,
				};
				return acc;
			},
			{} as Record<string, FormElementOptions>,
		);
		const dialog = new Dialog({
			title: "UV Optimizer",
			form: {
				algorithm: {
					type: "select",
					default: "skyline",
					label: "Packing Algorithm",
					options: {
						skyline: "Skyline",
					},
				},
				maxSize: {
					type: "number",
					value: Project ? Math.max(Project.texture_width, Project.texture_height) : 1024,
					label: "Maximum Texture Size",
					min: 1,
					max: 16384,
				},
				textureMode: {
					type: "select",
					default: "variant",
					label: "Texture Mode",
					options: {
						variant: "Variants",
						merge: "Merge Textures",
					},
				},
				textureModeInfo: {
					type: "info",
					text: "Merging textures combines all selected textures into one temporary texture. This prevents empty UV on different texture being optimized.<br>If 'Variant' is selected, each texture will have same UV layout.</b>",
				},
				padding: {
					type: "number",
					value: 0,
					label: "Padding Between UV",
					min: 0,
					max: 16,
				},
				similarCheck: {
					type: "checkbox",
					value: true,
					label: "Remove Duplicate UV",
				},
				similarityThreshold: {
					type: "number",
					value: 90,
					label: "Similarity Threshold (%)",
					min: 0,
					max: 100,
					description:
						"When 'Remove Duplicate UV' is enabled, UV faces with similar textures will share the same UV space to save texture area.\nThe similarity threshold defines how similar two textures must be (0% = completely different, 100% = identical).",
				},
				...textures,
				buttonBar: {
					type: "buttons",
					buttons: [
						"Select None",
						"Select All",
					],
					click(index) {
						dialog.setFormValues(
							Object.keys(textures).reduce(
								(acc, key) => {
									acc[key] = !!index;
									return acc;
								},
								{} as Record<string, boolean>,
							),
							true,
						);
					},
				},
			} satisfies Record<UnionString<keyof PackOptions>, FormElementOptions>,
			onConfirm: (formResult: FormResult) => this.optimize(formResult, textures),
		});
		dialog.show();
	}
	private optimize(formResult: FormResult, textures: Record<string, FormElementOptions>): void {
		if (!Project) {
			return;
		}
		const filteredTextures = Object.keys(textures).reduce((acc, key) => {
			const value = formResult[key];
			if (!value) {
				return acc;
			}
			const textureUUID = key.replace("_tex.", "");
			const texture = Texture.all.find((t) => t.uuid === textureUUID);
			if (texture) {
				acc.push(texture);
			}
			return acc;
		}, [] as Texture[]);
		if (!filteredTextures.length) {
			Blockbench.showQuickMessage("No textures selected.", 2000);
			return;
		}
		// Update UV Mode
		if (Project.box_uv) {
			Undo.initEdit({ elements: Cube.all, uv_mode: true });
			Cube.all.forEach((cube) => cube.setUVMode(false));
			Undo.finishEdit("Change UV Mode");
		}
		const firstTexture =
			formResult.textureMode === "merge"
				? this.mergeTextures(filteredTextures)
				: filteredTextures[0];
		const wFrames = Math.ceil(firstTexture.width / Project.texture_width);
		const hFrames = Math.ceil(firstTexture.height / Project.texture_height);
		console.log("f", wFrames, hFrames);
		const packer = new BinPacker(Cube.all, firstTexture);
		let result: PackResult;
		try {
			result = packer.pack(formResult);
		} catch (error) {
			Blockbench.showQuickMessage(`Packing failed: ${(error as Error).message}`, 4000);
			return;
		}
		// Update UVs
		Undo.initEdit({ elements: Cube.all, uv_mode: true });
		let maxWidth = 0;
		let maxHeight = 0;
		for (const cube of Cube.all) {
			for (const rect of result.rects) {
				if (cube.uuid !== rect.uuid) {
					continue;
				}
				const face = cube.faces[rect.face];
				face.uv = rect.placed.toUV();
				maxWidth = Math.max(maxWidth, face.uv[0], face.uv[2]);
				maxHeight = Math.max(maxHeight, face.uv[1], face.uv[3]);
			}
			cube.preview_controller.updateUV(cube);
		}
		Undo.finishEdit("Update UVs");
		// Update textures
		const newTextures: Texture[] = [];
		Undo.initEdit({ textures: newTextures });
		for (const texture of filteredTextures) {
			const newTexture = packer.exportTexture(result, texture, { maxHeight, maxWidth });
			newTextures.push(newTexture);
			newTexture.add(true);
		}
		Undo.finishEdit("add_texture");
		// Update project texture size
		Undo.initEdit({ uv_mode: true });
		const texture = newTextures[0];
		Project.texture_width = Math.ceil(texture.width / wFrames);
		Project.texture_height = Math.ceil(texture.height / hFrames);
		texture.select();
		Undo.finishEdit("Change Texture Size");
		// Apply changes
		Canvas.updateAll();
		Project.saved = false;
		Blockbench.showQuickMessage("UV Optimization Complete!", 2000);
	}
	private mergeTextures(textures: Texture[]): Texture {
		if (!Project) {
			throw new Error("No active project found.");
		}
		const canvas = document.createElement("canvas");
		canvas.width = textures[0].width;
		canvas.height = textures[0].height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get canvas context.");
		}
		const projectW = Project.texture_width;
		const projectH = Project.texture_height;
		for (const texture of textures) {
			const wFrames = Math.ceil(texture.width / projectW);
			const hFrames = Math.ceil(texture.height / projectH);
			if (wFrames > 1 || hFrames > 1) {
				for (let i = 0; i < wFrames; i++) {
					for (let j = 0; j < hFrames; j++) {
						ctx.drawImage(
							texture.canvas,
							i * projectW,
							j * projectH,
							projectW,
							projectH,
							0,
							0,
							projectW,
							projectH,
						);
					}
				}
			} else {
				ctx.drawImage(texture.canvas, 0, 0);
			}
		}
		const texture = new Texture({
			name: "merged_texture_temp",
			width: canvas.width,
			height: canvas.height,
		});
		texture.fromDataURL(canvas.toDataURL());
		texture.canvas = canvas;
		texture.ctx = ctx;
		return texture;
	}
}

const plugin = new BBUVOptimizerPlugin();
BBPlugin.register(plugin.id, plugin);

type UnionString<T extends string> = T | (string & {});
type FormResult = Required<PackOptions> & { [key: string]: boolean };
