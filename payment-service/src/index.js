const express = require('express');
const amqp = require('amqplib');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  user: 'payment_user',
  host: 'postgres',
  database: 'payment_db',
  password: 'payment_pass',
  port: 5432,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

let channel;
const QUEUE = 'payment_events';

async function connectRabbitMQ() {
  const connection = await amqp.connect('amqp://rabbit:rabbit@rabbitmq:5672');
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
}

app.post('/payments', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO payments (user_id, amount, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, amount, 'pending']
    );
    const payment = result.rows[0];
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify({
      type: 'payment_requested',
      paymentId: payment.id,
      userId,
      amount
    })));
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/payments/:id/confirm', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE payments SET status = $1 WHERE id = $2', ['success', id]);
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify({
      type: 'payment_confirmed',
      paymentId: id
    })));
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  try {
    await connectRabbitMQ();
    await initDb();
    console.log(`Payment service running on port ${PORT}`);
  } catch (err) {
    console.error('Erro ao iniciar payment-service:', err);
    process.exit(1);
  }
});
