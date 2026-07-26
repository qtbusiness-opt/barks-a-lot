import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // eslint-config-next doesn't enable no-undef, which once let a
  // reference to a deleted constant ship and crash the checkout review
  // step at runtime. Catch undefined identifiers at lint time.
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain Node.js CJS startup/seed scripts, not part of the Next.js app:
    "scripts/**",
  ]),
]);

export default eslintConfig;
