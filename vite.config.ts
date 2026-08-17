import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const localBindingConfig = {
  main: "./worker/index.ts",
  d1_databases: [],
  r2_buckets: [],
};

export default defineConfig(({ command, mode }) => {
  const localSecretBindings = command === "serve"
    ? (() => {
        const localEnv = loadEnv(mode, ".", "");
        return {
          GOOGLE_CLIENT_ID: localEnv.GOOGLE_CLIENT_ID ?? "",
          GOOGLE_CLIENT_SECRET: localEnv.GOOGLE_CLIENT_SECRET ?? "",
        };
      })()
    : {};

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: { ...localBindingConfig, vars: localSecretBindings },
      }),
    ],
  };
});
