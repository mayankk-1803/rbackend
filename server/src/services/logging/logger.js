import fs from "fs";
import path from "path";

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LEVEL = process.env.NODE_ENV === "production" ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

const formatLog = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  });
};

const writeLog = (level, message, meta = {}) => {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

  const logObj = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const logLine = JSON.stringify(logObj);

  if (process.env.NODE_ENV === "production") {
    console.log(logLine);
  } else {
    // Elegant colorised console logging for development
    const colors = {
      DEBUG: "\x1b[36m", // Cyan
      INFO: "\x1b[32m",  // Green
      WARN: "\x1b[33m",  // Yellow
      ERROR: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    const color = colors[level] || "";
    console.log(`[${logObj.timestamp}] ${color}${level}${reset}: ${message}`, Object.keys(meta).length ? meta : "");
  }
};

export const logger = {
  debug: (message, meta) => writeLog("DEBUG", message, meta),
  info: (message, meta) => writeLog("INFO", message, meta),
  warn: (message, meta) => writeLog("WARN", message, meta),
  error: (message, meta) => writeLog("ERROR", message, meta),
};

export default logger;
