#!/bin/bash

echo "📊 Communal Book Status"
echo "======================"

# Check MongoDB
if docker ps | grep -q communalbook-mongodb; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running"
fi

# Check Backend
if docker ps | grep -q communalbook-backend; then
    echo "✅ Backend is running (port 3000)"
else
    echo "❌ Backend is not running"
fi

# Check Frontend
if docker ps | grep -q communalbook-frontend; then
    echo "✅ Frontend is running (port 5173)"
else
    echo "❌ Frontend is not running"
fi

echo ""
echo "🌐 Access the app at: http://localhost:5173"