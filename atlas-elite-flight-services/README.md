# Atlas Elite Flight Services

Bookings are stored in `data/bookings.json` when `BLOB_READ_WRITE_TOKEN` is not configured. If a Vercel Blob token is configured, the same API automatically uses Vercel Blob for durable production storage.

## Local
npm install
npm start

## Production
For permanent storage across Vercel deployments/restarts, configure `BLOB_READ_WRITE_TOKEN` in Vercel. Without it, local JSON storage is intended for local development only.
