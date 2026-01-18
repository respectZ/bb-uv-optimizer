/// <reference types="blockbench-types"/>

import { BinPacker, type PackOptions } from "./core/binpacker_v2";

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
					value: true,
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
					default: "shelf",
					label: "Packing Algorithm",
					options: {
						shelf: "Shelf",
						maxrects: "MaxRects",
					},
				},
				maxSize: {
					type: "number",
					value: 1024,
					label: "Maximum Texture Size",
				},
				padding: {
					type: "number",
					value: 0,
					label: "Padding Between UV",
				},
				// removeDuplicateUV: {
				// 	type: "checkbox",
				// 	value: true,
				// 	label: "Remove Duplicate UV",
				// },
				sort: {
					type: "checkbox",
					value: true,
					label: "Sort UV by Size",
				},
				rotate: {
					type: "checkbox",
					value: true,
					label: "Allow Rotation",
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
		const result = packer.pack(formResult);
		// Update textures
		const newTextures: Texture[] = [];
		Undo.initEdit({ textures: newTextures });
		for (const texture of filteredTextures) {
			const newTexture = packer.exportTexture(result, texture);
			newTextures.push(newTexture);
			newTexture.add(true);
		}
		Undo.finishEdit("add_texture");
		// Update project texture size
		Undo.initEdit({ uv_mode: true });
		const firstNewTexture = newTextures[0];
		Project.texture_width = firstNewTexture.width;
		Project.texture_height = firstNewTexture.height;
		firstNewTexture.select();
		Undo.finishEdit("Change Texture Size");
		// Update uvs
		Undo.initEdit({ elements: Cube.all, uv_mode: true });
		const emptyUV = [
			firstNewTexture.width - 1,
			firstNewTexture.height - 1,
			firstNewTexture.width,
			firstNewTexture.height,
		] as [number, number, number, number];
		console.log("emptyUV", emptyUV);
		for (const cube of Cube.all) {
			for (const rect of result.rects) {
				if (cube.uuid !== rect.uuid) {
					continue;
				}
				const face = cube.faces[rect.face];
				if (rect.imageData) {
					face.uv = rect.placed.toUV();
				} else {
					face.uv = emptyUV;
				}
			}
			cube.preview_controller.updateUV(cube);
		}
		Undo.finishEdit("Update UVs");
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
