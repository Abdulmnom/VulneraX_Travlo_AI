#!/bin/bash
# Pull the required Ollama model into the Docker container
# Usage: ./scripts/pull-model.sh [model_name]

MODEL=${1:-qwen3:30b-a3b}

echo "Pulling Ollama model: $MODEL..."
docker exec -it travlo_ollama ollama pull "$MODEL"

echo "Done! Model '$MODEL' is now available."
