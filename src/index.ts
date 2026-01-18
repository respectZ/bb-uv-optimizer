/// <reference types="blockbench-types"/>

import { BinPacker, type PackOptions, type PackResult } from "./bin_packer";

// TODO: Texture select
// TODO: Animated texture
// TODO: Check mirrored UV
// TODO: Mers
// TODO: Better packing algorithms
// TODO: Texture settings (merge, variant)

class BBUVOptimizerPlugin implements PluginOptions {
	readonly id = "svdex.bb_uv_optimizer";
	readonly title = "UV Optimizer";
	author = "Svdex";
	description = "Optimize UV layouts for better texture space usage.";
	icon = "bar_chart";
	variant: "both" | "desktop" | "web" = "both";
	version = "0.1.0";
	action?: Action;
	constructor() {
		this.onload = this.onload.bind(this);
		this.onunload = this.onunload.bind(this);
	}
	onload(): void {
		this.action = new Action(this.id + ".action", {
			icon: "bar_chart",
			name: "Optimize UV Layout",
			condition: () => Format,
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
		const firstTexture = filteredTextures[0];
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
			// const newTexture = packer.exportTexture(result, texture, { maxHeight, maxWidth });
			const newTexture = packer.exportTexture(result, texture);
			newTextures.push(newTexture);
			newTexture.add(true);
		}
		Undo.finishEdit("add_texture");
		// Update project texture size
		Undo.initEdit({ uv_mode: true });
		const texture = newTextures[0];
		const wFrames = Math.ceil(texture.width / (Project.texture_width ?? 1));
		const hFrames = Math.ceil(texture.height / (Project.texture_height ?? 1));
		Project.texture_width = Math.ceil(texture.width / wFrames);
		Project.texture_height = Math.ceil(texture.height / hFrames);
		texture.select();
		Undo.finishEdit("Change Texture Size");
		// Apply changes
		Canvas.updateAll();
		Project.saved = false;
		Blockbench.showQuickMessage("UV Optimization Complete!", 2000);
	}
}

const plugin = new BBUVOptimizerPlugin();
BBPlugin.register(plugin.id, plugin);

type UnionString<T extends string> = T | (string & {});
type FormResult = Required<PackOptions> & { [key: string]: boolean };
