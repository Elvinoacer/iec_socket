# IEC ELC Server

Standalone Express + Socket.IO backend server.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

3. Start development server:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Run server in watch mode with tsx
- `npm run build` - Compile TypeScript to dist/
- `npm run start` - Run compiled server from dist/
- `npm run check` - Type-check without emitting output

## Health Endpoint

- `GET /health`
# iec_socket
