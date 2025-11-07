/// <reference types="blockbench-types"/>
import { BinPacker, type PackOptions } from "./core/bin_packer";
import { createTextures } from "./core/create_texture";

// TODO: Texture select
// TODO: Animated texture
// TODO: Check mirrored UV
// TODO: Mers
// TODO: Better packing algorithms

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
			click: () => {
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
						sort: {
							type: "checkbox",
							value: true,
							label: "Sort UV by Size",
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
					onConfirm(formResult: FormResult) {
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
							Blockbench.showQuickMessage("No textures selected for optimization.", 2000);
							return;
						}
						// Update UV mode
						if (Project.box_uv) {
							Undo.initEdit({ elements: Cube.all, uv_mode: true });
							Cube.all.forEach((cube) => cube.setUVMode(false));
							Undo.finishEdit("Change UV Mode");
						}

						const packer = new BinPacker(cubes);
						const result = packer.pack(formResult);

						// Update textures
						let newTextures: Texture[] = [];
						Undo.initEdit({ textures: newTextures });
						newTextures = createTextures(result, filteredTextures);
						let first = false;
						for (const texture of newTextures) {
							texture.add(true);
							if (!first) {
								texture.select();
								first = true;
							}
						}
						Undo.finishEdit("add_texture");

						// Update project texture size
						Undo.initEdit({ uv_mode: true });
						Project.texture_width = result.width;
						Project.texture_height = result.height;
						Undo.finishEdit("change_project_texture_size");

						// Update uvs
						Undo.initEdit({ elements: Cube.all, uv_mode: true });
						for (const cube of cubes) {
							for (const resultRect of result.placed) {
								if (cube.uuid === resultRect.uuid) {
									if (resultRect.width === -1 && resultRect.height === -1) {
										const face = cube.faces[resultRect.face];
										face.uv = [0, 0, 0, 0];
										continue;
									}
									const face = cube.faces[resultRect.face];
									const newU0 = resultRect.newLocation.x;
									const newV0 = resultRect.newLocation.y;
									const newU2 = resultRect.newLocation.x + resultRect.width;
									const newV2 = resultRect.newLocation.y + resultRect.height;
									face.uv = [newU0, newV0, newU2, newV2];
								}
								cube.preview_controller.updateUV(cube);
								cube.preview_controller.updateFaces(cube);
							}
						}
						Canvas.updateAll();
						Undo.finishEdit("optimize_uv_layout");
						Project.saved = false;
						Blockbench.showQuickMessage("UV layout optimized.", 2000);
					},
				});
				dialog.show();
			},
		});
	}
	onunload(): void {
		this.action?.delete();
	}
}

const plugin = new BBUVOptimizerPlugin();
BBPlugin.register(plugin.id, plugin);

type UnionString<T extends string> = T | (string & {});
type FormResult = Required<PackOptions> & { [key: string]: boolean };
