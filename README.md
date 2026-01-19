# bb-uv-optimizer

Blockbench plugin for optimizing uv textures.

- [Rectangle Packing](https://en.wikipedia.org/wiki/Rectangle_packing)

![preview](preview.gif)

## Features

- Optimize UV Texture
- Can be undo-ed (requires several times since it's a complex steps)
- Automatically converts from Box UV into Per-face UV
- Remove similar Texture UV within threshold
- Support multiple texture variants
- Support animated textures
- Adjustable padding to prevent bleeding
