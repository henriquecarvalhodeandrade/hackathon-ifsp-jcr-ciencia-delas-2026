import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
      // "server-only" lança erro fora de um React Server Component; nos testes usamos o
      // módulo vazio (o mesmo que o Next usa no servidor) para poder testar código de servidor.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
