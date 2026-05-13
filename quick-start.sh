#!/bin/bash

# Stop any existing containers
docker-compose -f docker-compose.dev.yml down 2>/dev/null

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# Wait a moment
sleep 3

# Clear screen
clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖  COMMUNAL BOOK - NOW RUNNING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Open your app:"
echo "   http://localhost:5173"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Status:"
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🛑 To stop: docker-compose -f docker-compose.dev.yml down"
echo "📋 To see errors: docker-compose -f docker-compose.dev.yml logs --tail=50"