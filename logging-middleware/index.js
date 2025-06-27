const axios = require('axios');

const validPackages = {
  backend: new Set([
    "cache", "controller", "cron_job", "db", "domain",
    "handler", "repository", "route", "service"
  ]),
  frontend: new Set([
    "api", "component", "hook", "page", "state", "style"
  ])
};

const validLevels = new Set([
  "debug", "info", "warn", "error", "fatal"
]);

async function Log(stack, level, package, message) {
  stack = stack.toLowerCase();
  level = level.toLowerCase();
  package = package.toLowerCase();

  if (!['backend', 'frontend'].includes(stack)) {
    console.error(`Invalid stack: ${stack}. Must be 'backend' or 'frontend'`);
    return;
  }

  if (!validLevels.has(level)) {
    console.error(`Invalid level: ${level}. Must be one of: ${Array.from(validLevels).join(', ')}`);
    return;
  }

  if (!validPackages[stack].has(package)) {
    console.error(`Invalid package '${package}' for stack '${stack}'. Allowed: ${Array.from(validPackages[stack]).join(', ')}`);
    package = stack === 'backend' ? 'handler' : 'component';
  }

  const logData = {
    stack,
    level,
    package,
    message: message.substring(0, 500)
  };

  try {
    const response = await axios.post(
      'http://20.244.56.144/evaluation-service/logs',
      logData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );
    console.log(`Log successful (${response.status})`);
    return true;
  } catch (error) {
    const errorInfo = {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        data: error.config?.data
      }
    };
    
    console.error('Logging failed:', errorInfo);
    console.log(`[FALLBACK LOG] ${new Date().toISOString()} [${stack.toUpperCase()}] ${level.toUpperCase()}:${package} - ${message}`);
    return false;
  }
}

module.exports = Log;