#!/bin/bash

echo "🛑 Stopping Communal Book..."

docker-compose -f docker-compose.dev.yml down

echo "✅ Services stopped"