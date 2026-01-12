#!/bin/bash

# Fix ChordsMaster Container Port Mapping
# This script recreates the ChordsMaster container with the correct port (8090)

set -e

echo "🔧 Fixing ChordsMaster Container Port Mapping"
echo "=============================================="
echo ""

CONTAINER_NAME="pocketbase-chords-master"
PROJECT_ID="0tjCEOeRTdNI"

# Check if running remotely
if [ -z "$DOCKER_HOST" ]; then
    echo "⚠️  DOCKER_HOST not set. Using local Docker."
    echo ""
    read -p "Are you sure you want to proceed with LOCAL Docker? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
else
    echo "✅ Using remote Docker: $DOCKER_HOST"
fi

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container $CONTAINER_NAME not found"
    exit 1
fi

echo "📊 Current container status:"
docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "🔍 Verifying PocketBase is running on port 8090..."
if docker exec $CONTAINER_NAME wget -q -O- http://localhost:8090/api/health > /dev/null 2>&1; then
    echo "✅ PocketBase is healthy on port 8090"
else
    echo "❌ PocketBase not responding on port 8090"
    echo "Container may have issues. Check logs with: docker logs $CONTAINER_NAME"
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will recreate the container"
echo "   - Data is preserved (volumes are kept)"
echo "   - Container will be briefly offline"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Get current container configuration
echo ""
echo "📋 Extracting current configuration..."
IMAGE=$(docker inspect $CONTAINER_NAME --format '{{.Config.Image}}')
NETWORK=$(docker inspect $CONTAINER_NAME --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')

# Get volume paths
PB_DATA=$(docker inspect $CONTAINER_NAME --format '{{range .Mounts}}{{if eq .Destination "/pb_data"}}{{.Source}}{{end}}{{end}}')
PB_PUBLIC=$(docker inspect $CONTAINER_NAME --format '{{range .Mounts}}{{if eq .Destination "/pb_public"}}{{.Source}}{{end}}{{end}}')
PB_MIGRATIONS=$(docker inspect $CONTAINER_NAME --format '{{range .Mounts}}{{if eq .Destination "/pb_migrations"}}{{.Source}}{{end}}{{end}}')
PB_HOOKS=$(docker inspect $CONTAINER_NAME --format '{{range .Mounts}}{{if eq .Destination "/pb_hooks"}}{{.Source}}{{end}}{{end}}')

# Get encryption key
ENCRYPTION_KEY=$(docker inspect $CONTAINER_NAME --format '{{range .Config.Env}}{{println .}}{{end}}' | grep PB_ENCRYPTION_KEY | cut -d'=' -f2)

echo "   Image: $IMAGE"
echo "   Network: $NETWORK"
echo "   Data Volume: $PB_DATA"

# Stop and remove old container
echo ""
echo "🛑 Stopping old container..."
docker stop $CONTAINER_NAME

echo "🗑️  Removing old container..."
docker rm $CONTAINER_NAME

# Recreate with correct port
echo ""
echo "🚀 Creating new container with correct port (8090)..."

docker run -d \
  --name $CONTAINER_NAME \
  --network $NETWORK \
  -p 8091:8090 \
  -v "$PB_DATA:/pb_data" \
  -v "$PB_PUBLIC:/pb_public" \
  -v "$PB_MIGRATIONS:/pb_migrations" \
  -v "$PB_HOOKS:/pb_hooks" \
  -e "PB_ENCRYPTION_KEY=$ENCRYPTION_KEY" \
  --restart unless-stopped \
  --label traefik.enable=true \
  --label "traefik.http.routers.chords-master.rule=Host(\`chords-master.db.oceannet.dev\`)" \
  --label traefik.http.routers.chords-master.entrypoints=websecure \
  --label traefik.http.services.chords-master.loadbalancer.server.port=8090 \
  --label traefik.http.routers.chords-master.tls=true \
  --label traefik.http.routers.chords-master.tls.certresolver=letsencrypt \
  $IMAGE

echo ""
echo "⏳ Waiting for container to start..."
sleep 3

# Verify new container
echo ""
echo "✅ New container status:"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🧪 Testing connection..."
if docker exec $CONTAINER_NAME wget -q -O- http://localhost:8090/api/health > /dev/null 2>&1; then
    echo "✅ PocketBase is healthy!"
else
    echo "⚠️  PocketBase not responding yet. Check logs: docker logs $CONTAINER_NAME"
fi

echo ""
echo "📝 Test external connection:"
echo "   curl https://chords-master.db.oceannet.dev/api/health"
echo ""
echo "✅ Container recreated successfully!"

