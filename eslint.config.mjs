import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
	...tseslint.configs.strict,
	{
		rules: {
			curly: "warn",
			eqeqeq: "warn",
			"@typescript-eslint/naming-convention": [
				"warn",
				{
					selector: "variable",
					format: ["camelCase", "PascalCase"],
					leadingUnderscore: "allow",
					trailingUnderscore: "allow",
				},
				{
					selector: "typeLike",
					format: ["PascalCase"],
					leadingUnderscore: "allow",
				},
			],
			"@typescript-eslint/no-extraneous-class": "off",
		},
	},
]);
