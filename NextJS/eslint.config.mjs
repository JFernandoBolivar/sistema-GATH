import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // NO quites las languageOptions si ya te funcionan
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // --- RESTRICCIONES ACTIVADAS ---

      // 1. PROHIBIDO usar 'any' (Lo que querías arreglar)
      "@typescript-eslint/no-explicit-any": "error",

      // 2. Obligatorio usar reglas de Hooks (Evita bugs de renderizado)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // 3. Limpieza de variables no usadas (Solo ignora las que empiezan con _)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // 4. Reactivar advertencias de imágenes y accesibilidad
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",

      // 5. No permitir expresiones sin uso (ej: funciones que no se llaman)
      "@typescript-eslint/no-unused-expressions": "error",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
