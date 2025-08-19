{
  "apps": [
    {
      "name": "whatsapp-otp-bot",
      "script": "app.js",
      "cwd": "/opt/whatsapp-otp-bot",
      "instances": 1,
      "exec_mode": "cluster",
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3000
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": 3000
      },
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "error_file": "/opt/whatsapp-otp-bot/logs/pm2-error.log",
      "out_file": "/opt/whatsapp-otp-bot/logs/pm2-out.log",
      "log_file": "/opt/whatsapp-otp-bot/logs/pm2-combined.log",
      "time": true,
      "autorestart": true,
      "max_restarts": 10,
      "min_uptime": "10s",
      "restart_delay": 4000,
      "kill_timeout": 3000,
      "wait_ready": true,
      "listen_timeout": 8000,
      "shutdown_with_message": true,
      "source_map_support": false,
      "disable_source_map_support": true,
      "merge_logs": true,
      "log_type": "json"
    }
  ]
}