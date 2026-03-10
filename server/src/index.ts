import express from 'express';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ContentFactory server listening on port ${PORT}`);
});

export { app };
