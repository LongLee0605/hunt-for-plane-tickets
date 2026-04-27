import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "dist-server/**", ".next/**", "node_modules/**"]),
]);
