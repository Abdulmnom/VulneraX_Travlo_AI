# Pull the required Ollama model into the Docker container
# Usage: .\scripts\pull-model.ps1 [model_name]

param(
    [string]$Model = "qwen3:30b-a3b"
)

Write-Host "Pulling Ollama model: $Model..."
docker exec -it travlo_ollama ollama pull "$Model"

Write-Host "Done! Model '$Model' is now available."
