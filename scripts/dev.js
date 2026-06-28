const { spawnSync } = require("child_process");
const path = require("path");

delete process.env.ELECTRON_RUN_AS_NODE;

const bin = path.join(__dirname, "..", "node_modules", ".bin", "electron-vite");
const result = spawnSync(bin, ["dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 0);
