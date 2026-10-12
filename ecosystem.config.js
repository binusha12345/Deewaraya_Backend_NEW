module.exports = {
  apps: [
    {
      name: "deewaraya-backend",
      script: "server.js",
      watch: false, // Session files වෙනස් වන විට restart වීම වැළැක්වීමට
      max_memory_restart: "1G", // Memory එක වැඩි වුවහොත් auto restart කිරීමට
      min_uptime: "10s", // Restart loop එකක් වැළැක්වීමට
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
