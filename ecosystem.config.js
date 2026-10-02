module.exports = {
  apps: [
    {
      name: "deewaraya-backend",
      script: "server.js",
      watch: false, // Session files වෙනස් වන විට restart වීම වැළැක්වීමට
      max_memory_restart: "500M", // Memory එක වැඩි වුවහොත් auto restart කිරීමට
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};