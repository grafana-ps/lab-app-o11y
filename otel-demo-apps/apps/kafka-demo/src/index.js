const express = require('express');
const { Kafka, logLevel } = require('kafkajs');
const winston = require('winston');
const { OpenTelemetryTransportV3 } = require('@opentelemetry/winston-transport');

// Configuration from environment
const PORT = process.env.PORT || 8080;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'demo-topic';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'demo-group';
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'kafka-demo';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'kafka-demo';
const PRODUCE_INTERVAL_MS = parseInt(process.env.PRODUCE_INTERVAL_MS || '5000', 10);

// Winston logger with JSON format for OTel compatibility
const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console(),
    new OpenTelemetryTransportV3()
  ]
});

// Kafka client setup
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.INFO,
  logCreator: () => ({ namespace, level, label, log: logData }) => {
    const { message, ...extra } = logData;
    const levelName = {
      [logLevel.ERROR]: 'error',
      [logLevel.WARN]: 'warn',
      [logLevel.INFO]: 'info',
      [logLevel.DEBUG]: 'debug',
    }[level] || 'info';
    log[levelName](`[kafkajs:${namespace}] ${message}`, extra);
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

// Express app for health checks
const app = express();
app.use(express.json());

let isHealthy = false;
let messagesSent = 0;
let messagesReceived = 0;

// Health check endpoint
app.get('/health', (req, res) => {
  if (isHealthy) {
    res.json({
      status: 'healthy',
      service: SERVICE_NAME,
      kafka: {
        brokers: KAFKA_BROKERS,
        topic: KAFKA_TOPIC,
        groupId: KAFKA_GROUP_ID
      },
      stats: {
        messagesSent,
        messagesReceived
      }
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      service: SERVICE_NAME,
      message: 'Kafka not connected'
    });
  }
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    messagesSent,
    messagesReceived,
    uptime: process.uptime()
  });
});

// Manual produce endpoint for testing
app.post('/produce', async (req, res) => {
  try {
    const message = req.body.message || `Manual message at ${new Date().toISOString()}`;
    await sendMessage(message);
    res.json({ success: true, message });
  } catch (error) {
    log.error('Failed to produce message via API', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send a message to Kafka
async function sendMessage(content) {
  const message = {
    key: `key-${Date.now()}`,
    value: JSON.stringify({
      content,
      timestamp: new Date().toISOString(),
      producer: KAFKA_CLIENT_ID
    })
  };

  log.info('Producing message', { topic: KAFKA_TOPIC, key: message.key });

  await producer.send({
    topic: KAFKA_TOPIC,
    messages: [message]
  });

  messagesSent++;
  log.info('Message sent successfully', { topic: KAFKA_TOPIC, key: message.key, totalSent: messagesSent });
}

// Producer loop - sends a message every PRODUCE_INTERVAL_MS
async function startProducer() {
  log.info('Starting producer loop', { interval: PRODUCE_INTERVAL_MS });

  setInterval(async () => {
    try {
      await sendMessage(`Periodic message #${messagesSent + 1}`);
    } catch (error) {
      log.error('Error in producer loop', { error: error.message });
    }
  }, PRODUCE_INTERVAL_MS);
}

// Consumer handler
async function startConsumer() {
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

  log.info('Consumer subscribed', { topic: KAFKA_TOPIC, groupId: KAFKA_GROUP_ID });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      messagesReceived++;
      const value = message.value ? message.value.toString() : null;

      log.info('Message received', {
        topic,
        partition,
        offset: message.offset,
        key: message.key ? message.key.toString() : null,
        value,
        totalReceived: messagesReceived
      });

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      log.info('Message processed', {
        topic,
        partition,
        offset: message.offset
      });
    }
  });
}

// Graceful shutdown
async function shutdown() {
  log.info('Shutting down...');
  isHealthy = false;

  try {
    await consumer.disconnect();
    log.info('Consumer disconnected');
  } catch (error) {
    log.error('Error disconnecting consumer', { error: error.message });
  }

  try {
    await producer.disconnect();
    log.info('Producer disconnected');
  } catch (error) {
    log.error('Error disconnecting producer', { error: error.message });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Main startup
async function main() {
  log.info('Starting kafka-demo service', {
    brokers: KAFKA_BROKERS,
    topic: KAFKA_TOPIC,
    groupId: KAFKA_GROUP_ID,
    clientId: KAFKA_CLIENT_ID
  });

  try {
    // Connect producer
    await producer.connect();
    log.info('Producer connected');

    // Connect consumer
    await consumer.connect();
    log.info('Consumer connected');

    // Create topic if it doesn't exist (admin API)
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    if (!topics.includes(KAFKA_TOPIC)) {
      log.info('Creating topic', { topic: KAFKA_TOPIC });
      await admin.createTopics({
        topics: [{ topic: KAFKA_TOPIC, numPartitions: 1, replicationFactor: 1 }]
      });
      log.info('Topic created', { topic: KAFKA_TOPIC });
    }
    await admin.disconnect();

    isHealthy = true;

    // Start consumer
    await startConsumer();

    // Start producer loop
    await startProducer();

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      log.info('HTTP server started', { port: PORT });
    });

  } catch (error) {
    log.error('Failed to start service', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();
