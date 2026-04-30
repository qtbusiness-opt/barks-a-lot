import { defineConfig, env } from "prisma/config";

export default defineConfig({
    migrations: {
        seed: 'bun run ./prisma/seed.ts',
    },
    datasource: {
        url: env("DATABASE_URL",)
    },
});