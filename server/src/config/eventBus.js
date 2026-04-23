import { EventEmitter } from 'events';
import IORedis from "ioredis";

const redisConfig = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null
};

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.pub = new IORedis(redisConfig);
    this.sub = new IORedis(redisConfig);

    this.sub.subscribe("internal_events");
    this.sub.on("message", (channel, message) => {
      if (channel === "internal_events") {
        const { event, data } = JSON.parse(message);
        super.emit(event, data);
      }
    });
  }

  emit(event, data) {
    // Publish to Redis for cross-process communication
    this.pub.publish("internal_events", JSON.stringify({ event, data }));
    // Also emit locally for the current process
    super.emit(event, data);
  }
}

const eventBus = new EventBus();

export default eventBus;
