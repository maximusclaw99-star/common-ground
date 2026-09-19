import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The design system is vendored: we consume it, we do not own its style.
    // public/tb is a build artefact synced from it by scripts/sync-design.mjs.
    "design/**",
    "public/tb/**",
  ]),
]);

export default eslintConfig;
