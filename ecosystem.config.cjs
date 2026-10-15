/**
 * PM2 ecosystem file for Dungeon of Jev (served publicly at https://doj.blocbrain.xyz via Caddy).
 *
 *   pm2 start ecosystem.config.cjs   # start (or update)
 *   pm2 logs dungeon-of-jev          # tail logs, including every [jev] decision
 *   pm2 restart dungeon-of-jev       # after code or .env changes
 *   pm2 save                         # persist the process list
 *
 * Bun auto-loads .env from cwd (TYPESAFE_API_KEY). Listens on 127.0.0.1:3210 only.
 */
module.exports = {
  apps: [
    {
      name: "dungeon-of-jev",
      script: "server.ts",
      cwd: __dirname,
      interpreter: require("node:path").join(require("node:os").homedir(), ".bun/bin/bun"),
      interpreter_args: "run",
      env: { NODE_ENV: "production", PORT: "3210", HOST: "127.0.0.1" },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: "10s",
      max_memory_restart: "512M",
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
