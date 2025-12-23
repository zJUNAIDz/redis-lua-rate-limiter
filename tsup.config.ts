import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    hono: "src/hono/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
});
