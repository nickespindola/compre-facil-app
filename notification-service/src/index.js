require('dotenv').config();
const express = require('express');
const amqplib = require('amqplib');

const app = express();
app.use(express.json());

const AMQP_URL = process.env.AMQP_URL || 'amqp://rabbit:rabbit@rabbitmq:5672';
const QUEUE = process.env.AMQP_QUEUE || 'payment_events';
const PORT = process.env.PORT || 3002;

let channel;
// buffer em memória para expor via REST
const lastEvents = [];

function pushEvent(evt) {
  lastEvents.unshift({ ...evt, receivedAt: new Date().toISOString() });
  if (lastEvents.length > 50) lastEvents.pop();
}

async function connectRabbitMQ() {
  const connection = await amqplib.connect(AMQP_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(20);

  channel.consume(QUEUE, (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      if (event.type === 'payment_requested') {
        console.log(`Notificando usuário ${event.userId}: pagamento solicitado de R$${event.amount}`);
      } else if (event.type === 'payment_confirmed') {
        console.log(`Notificando usuário: pagamento ${event.paymentId} confirmado!`);
      } else {
        console.log('Evento desconhecido:', event);
      }
      pushEvent({ type: event.type, payload: event });
      channel.ack(msg);
    } catch (e) {
      console.error('Erro ao processar mensagem', e);
      channel.nack(msg, false, false);
    }
  }, { noAck: false });
}

// endpoints REST
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/events', (_req, res) => {
  res.json({ count: lastEvents.length, items: lastEvents });
});

app.listen(PORT, async () => {
  await connectRabbitMQ();
  console.log(`Notification service running on port ${PORT}`);
});