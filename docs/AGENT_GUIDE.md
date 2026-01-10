# AI Agent / Cursor Integration Guide

This guide explains how to use the PocketBase Multi-Project Server with AI agents, Cursor, or any automation tool.

## Quick Reference

### Create a New Database for a Project

```bash
# From the terminal in Cursor:
cd /path/to/multi-project-server

# Create a new project
npm run cli create \
  --name "Client App Name" \
  --slug "client-app" \
  --client "Client Company" \
  --email "client@company.com"

# Get the API URL for use in your app
npm run cli url client-app --api
```

### Common Commands

```bash
# List all projects
npm run cli list

# Get project info (JSON format for parsing)
npm run cli info client-app --json

# Start/stop a project
npm run cli start client-app
npm run cli stop client-app

# Create a backup before changes
npm run cli backup create client-app

# View logs
npm run cli logs client-app --tail 50
```

## API Usage

For programmatic access, use the REST API:

### Authentication

All API requests require the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/projects
```

### Create Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "name": "My New App",
    "slug": "my-new-app",
    "clientName": "Client Corp",
    "clientEmail": "client@corp.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123xyz",
    "name": "My New App",
    "slug": "my-new-app",
    "status": "running",
    "port": 8090,
    "domain": "my-new-app.pocketbase.youragency.com"
  },
  "urls": {
    "api": "http://localhost:8090",
    "admin": "http://localhost:8090/_/"
  }
}
```

### List Projects

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/projects
```

### Get Project Details

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/projects/my-new-app
```

### Delete Project

```bash
curl -X DELETE -H "x-api-key: your-api-key" http://localhost:3000/api/projects/my-new-app
```

## Integration Patterns

### 1. React/Next.js Project Setup

When creating a new React or Next.js project that needs a backend:

```bash
# Step 1: Create the PocketBase instance
npm run cli create --name "My React App Backend" --slug "my-react-app"

# Step 2: Get the API URL
API_URL=$(npm run cli url my-react-app --api 2>/dev/null)

# Step 3: Create .env file in your React project
echo "NEXT_PUBLIC_POCKETBASE_URL=$API_URL" >> ../my-react-app/.env.local
```

### 2. Vue/Nuxt Project Setup

```bash
# Create backend
npm run cli create --name "Vue App" --slug "vue-app"

# Get URL and add to nuxt.config
API_URL=$(npm run cli url vue-app --api 2>/dev/null)
echo "NUXT_PUBLIC_PB_URL=$API_URL" >> ../vue-app/.env
```

### 3. Mobile App (React Native/Flutter)

```bash
# Create backend
npm run cli create --name "Mobile App Backend" --slug "mobile-backend"

# For production, use the domain URL
npm run cli url mobile-backend
# Output: https://mobile-backend.pocketbase.youragency.com
```

## Workflow Examples

### Setting Up a Complete Project

```bash
#!/bin/bash
PROJECT_NAME=$1
CLIENT_NAME=$2

# 1. Create PocketBase backend
npm run cli create \
  --name "$PROJECT_NAME Backend" \
  --slug "${PROJECT_NAME,,}-backend" \
  --client "$CLIENT_NAME"

# 2. Wait for it to be ready
sleep 5

# 3. Get the URLs
API_URL=$(npm run cli url "${PROJECT_NAME,,}-backend" --api 2>/dev/null)
ADMIN_URL=$(npm run cli url "${PROJECT_NAME,,}-backend" --admin 2>/dev/null)

echo "Backend created!"
echo "API URL: $API_URL"
echo "Admin URL: $ADMIN_URL"
echo ""
echo "Next steps:"
echo "1. Visit $ADMIN_URL to create admin account"
echo "2. Set up your collections"
echo "3. Use $API_URL in your frontend"
```

### Backup Before Deployment

```bash
#!/bin/bash
PROJECT=$1

# Create backup
npm run cli backup create "$PROJECT"

# Deploy changes
# ... your deployment commands ...

# If something goes wrong, restore:
# npm run cli backup list "$PROJECT"
# npm run cli backup restore "$PROJECT" "backup-filename.tar.gz"
```

### Environment Setup Script

```bash
#!/bin/bash
# setup-dev-environment.sh

# Ensure manager is running
docker-compose up -d

# Wait for API
until curl -s http://localhost:3000/api/health/ready > /dev/null; do
  echo "Waiting for manager..."
  sleep 2
done

echo "Manager is ready!"
echo ""
echo "Commands:"
echo "  npm run cli list        - List projects"
echo "  npm run cli create -i   - Create new project"
echo "  npm run cli stats       - View statistics"
```

## JSON Output Parsing

For automation, use the `--json` flag and parse with `jq`:

```bash
# Get project status
npm run cli info my-project --json | jq -r '.status'

# Get API URL
npm run cli info my-project --json | jq -r '.urls.api'

# List running projects
npm run cli list --json | jq '.[] | select(.status == "running") | .slug'

# Get total storage used
npm run cli stats --json | jq -r '.totalStorage'
```

## Error Handling

```bash
# Check if project exists
if npm run cli info my-project --json 2>/dev/null | jq -e '.id' > /dev/null; then
  echo "Project exists"
else
  echo "Project not found, creating..."
  npm run cli create --name "My Project"
fi

# Check if project is running
STATUS=$(npm run cli info my-project --json 2>/dev/null | jq -r '.status')
if [ "$STATUS" != "running" ]; then
  npm run cli start my-project
fi
```

## Tips for AI Agents

1. **Always use `--json` flag** when parsing output programmatically
2. **Check project status** before performing operations
3. **Create backups** before destructive operations
4. **Use slugs** for project identification (more stable than IDs)
5. **Handle errors** - check exit codes and response success field

## Security Notes

- Store API keys in environment variables, never in code
- Use HTTPS in production
- Restrict `allowed_ssh_cidrs` and `allowed_api_cidrs` in Terraform
- Rotate API keys periodically

