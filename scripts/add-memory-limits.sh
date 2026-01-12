#!/bin/bash

# This script adds memory limits to existing containers
# Run this to retroactively apply memory limits to containers created without them

set -e

echo "🔧 Adding Memory Limits to Existing Containers"
echo "=============================================="
echo ""

# Container memory limit configurations
declare -A MEMORY_LIMITS
MEMORY_LIMITS["pocketbase-manager"]="512m"
MEMORY_LIMITS["traefik"]="256m"
MEMORY_LIMITS["pocketbase-chords-master"]="256m"

# Check if DOCKER_HOST is set
if [ -z "$DOCKER_HOST" ]; then
  echo "⚠️  DOCKER_HOST not set. Using local Docker."
  echo "   For remote Docker, set: export DOCKER_HOST=tcp://localhost:2375"
  echo ""
fi

echo "📊 Current Container Memory Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo ""

# Function to update container memory limit
update_container_memory() {
  local container_name=$1
  local memory_limit=$2
  
  echo "🔄 Updating $container_name to $memory_limit..."
  
  # Check if container exists
  if ! docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    echo "   ⏭️  Container $container_name not found, skipping"
    return
  fi
  
  # Get current container configuration
  local running=$(docker inspect "$container_name" --format '{{.State.Running}}')
  
  # Update the container
  docker update --memory "$memory_limit" "$container_name" >/dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Updated $container_name memory limit to $memory_limit"
  else
    echo "   ⚠️  Failed to update $container_name (may require recreation)"
  fi
}

# Update all containers
for container in "${!MEMORY_LIMITS[@]}"; do
  update_container_memory "$container" "${MEMORY_LIMITS[$container]}"
done

echo ""
echo "📊 Updated Container Limits:"
for container in "${!MEMORY_LIMITS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
    limit=$(docker inspect "$container" --format '{{.HostConfig.Memory}}')
    if [ "$limit" -gt 0 ]; then
      limit_hr=$(echo $limit | awk '{printf "%.0f MB", $1/1024/1024}')
      echo "   $container: $limit_hr"
    else
      echo "   $container: No limit (unlimited)"
    fi
  fi
done

echo ""
echo "✅ Memory limits updated!"
echo ""
echo "💡 Note: New containers created via the dashboard will"
echo "   automatically have memory limits (default: 256m)"
echo ""
echo "📈 Monitor memory usage: docker stats"

