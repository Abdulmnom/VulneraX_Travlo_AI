This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

## Getting Started

### 1. Start the services with Docker

```bash
docker-compose up -d
```

This starts:
- Next.js application (proxied via Nginx on port 80)
- Ollama LLM service (internal)
- MongoDB (internal)

### 2. Pull the required Ollama model

The application requires an Ollama model to generate recommendations. Pull it with:

**Linux/Mac:**
```bash
./scripts/pull-model.sh
```

**Windows:**
```powershell
.\scripts\pull-model.ps1
```

Or manually:
```bash
docker exec -it travlo_ollama ollama pull qwen3:30b-a3b
```

> **Note:** You can use a different model by setting the `OLLAMA_MODEL` environment variable in your `.env` file.

### 3. Access the application

Open [http://localhost](http://localhost) in your browser.

## Development

Run the development server locally (requires Ollama to be running):

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL of the Ollama API |
| `OLLAMA_MODEL` | `qwen3:30b-a3b` | Model to use for recommendations |

## Troubleshooting

### "Ollama model not found" error

The model hasn't been pulled yet. Run the pull script (see step 2 above).

### Check available models

```bash
docker exec travlo_ollama ollama list
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
