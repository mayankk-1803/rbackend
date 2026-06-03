import { redisClient } from "../../config/redis.js";

// Redis metrics tracking helpers
export const incrementMetric = async (name, value = 1, labels = {}) => {
  try {
    const key = `metrics:${name}`;
    await redisClient.hincrby(key, JSON.stringify(labels), value);
  } catch (err) {
    console.error(`[METRICS] Failed to increment metric ${name}:`, err.message);
  }
};

export const observeMetric = async (name, duration, labels = {}) => {
  try {
    const key = `metrics:${name}:sum`;
    const countKey = `metrics:${name}:count`;
    await redisClient.incrbyfloat(key, duration);
    await redisClient.incr(countKey);
  } catch (err) {
    console.error(`[METRICS] Failed to observe metric ${name}:`, err.message);
  }
};

export const getPrometheusMetrics = async () => {
  const metricsList = [
    "dizipay_route_resolution_duration_seconds",
    "dizipay_provider_failover_count_total",
    "dizipay_circuit_breaker_trips_total",
    "dizipay_routing_cache_hits_total",
    "dizipay_routing_cache_misses_total",
    "dizipay_weighted_distribution_accuracy_deviation"
  ];

  let output = "";
  for (const m of metricsList) {
    const key = `metrics:${m}`;
    const sum = await redisClient.get(`${key}:sum`).catch(() => 0) || 0;
    const count = await redisClient.get(`${key}:count`).catch(() => 0) || 0;
    
    output += `# HELP ${m} Routing suite metric ${m}\n`;
    output += `# TYPE ${m} gauge\n`;
    if (Number(count) > 0) {
      output += `${m}_sum ${sum}\n`;
      output += `${m}_count ${count}\n`;
      output += `${m}_avg ${(Number(sum) / Number(count)).toFixed(4)}\n`;
    } else {
      const hashVal = await redisClient.hgetall(key).catch(() => ({}));
      if (Object.keys(hashVal).length > 0) {
        for (const labelKey in hashVal) {
          const labels = JSON.parse(labelKey);
          const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
          output += `${m}{${labelStr}} ${hashVal[labelKey]}\n`;
        }
      } else {
        output += `${m} 0\n`;
      }
    }
    output += "\n";
  }
  return output;
};

export default {
  incrementMetric,
  observeMetric,
  getPrometheusMetrics
};
