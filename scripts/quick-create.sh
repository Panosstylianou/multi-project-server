#!/bin/bash
# Quick create a new PocketBase project
# Usage: ./scripts/quick-create.sh "Project Name" "client-slug" "Client Name" "client@email.com"

set -e

PROJECT_NAME="${1:-New Project}"
SLUG="${2:-}"
CLIENT_NAME="${3:-}"
CLIENT_EMAIL="${4:-}"

echo "Creating PocketBase project: $PROJECT_NAME"

# Build command
CMD="npm run cli create --name \"$PROJECT_NAME\""

if [ -n "$SLUG" ]; then
    CMD="$CMD --slug \"$SLUG\""
fi

if [ -n "$CLIENT_NAME" ]; then
    CMD="$CMD --client \"$CLIENT_NAME\""
fi

if [ -n "$CLIENT_EMAIL" ]; then
    CMD="$CMD --email \"$CLIENT_EMAIL\""
fi

# Execute
eval $CMD

echo ""
echo "Project created! Use 'npm run cli list' to see all projects."

