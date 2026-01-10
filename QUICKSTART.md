# Quick Start Guide - Local Development

Your PocketBase Multi-Project Server is now running! 🎉

## Running Services

- **Manager API**: http://localhost:3001
- **Traefik Dashboard**: http://localhost:9090
- **Health Check**: http://localhost:3001/api/health

## Created Project

✅ **Test Project** is running!
- **PocketBase Admin**: http://localhost:8090/_/
- **PocketBase API**: http://localhost:8090/api/

Visit http://localhost:8090/_/ to set up your admin account.

## Common Commands

### Using CLI (Recommended)

```bash
# Create a new project
npm run cli -- create --name "My Client App" --client "Client Name"

# List all projects
npm run cli -- list

# Get project details
npm run cli -- info test-project

# Get project URL
npm run cli -- url test-project

# Start/Stop projects
npm run cli -- stop test-project
npm run cli -- start test-project

# Create backup
npm run cli -- backup create test-project

# View logs
npm run cli -- logs test-project

# Delete project
npm run cli -- delete test-project
```

### Using API

**Note**: The API key in docker-compose is set to `your-secure-api-key-here`

```bash
# List projects
curl -H "x-api-key: your-secure-api-key-here" http://localhost:3001/api/projects

# Create project
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key-here" \
  -d '{"name": "New Project", "clientName": "Client Corp"}'

# Get project info
curl -H "x-api-key: your-secure-api-key-here" \
  http://localhost:3001/api/projects/test-project
```

## Docker Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f manager
docker logs pocketbase-test-project

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Rebuild after code changes
docker-compose build manager
docker-compose up -d
```

## Next Steps

1. **Set up your first PocketBase instance**:
   - Visit http://localhost:8090/_/
   - Create an admin account
   - Create your collections

2. **Create projects for clients**:
   ```bash
   npm run cli -- create --name "Acme Corp Website" --client "Acme Corp"
   ```

3. **Test in your frontend**:
   ```javascript
   // In your React/Vue/etc app
   import PocketBase from 'pocketbase';
   
   const pb = new PocketBase('http://localhost:8090');
   ```

4. **Deploy to AWS**:
   - See `docs/DEPLOYMENT.md` for production deployment
   - See `docs/AGENT_GUIDE.md` for Cursor/AI integration

## Port Configuration

Since ports 3000 and 8080 were in use, we're using:
- **Manager API**: Port 3001 (instead of 3000)
- **Traefik Dashboard**: Port 9090 (instead of 8080)
- **PocketBase instances**: Start at port 8090

## Troubleshooting

**Docker not running?**
```bash
open -a Docker  # Start Docker Desktop
docker ps       # Verify it's running
```

**Port conflicts?**
Edit `docker-compose.yml` and change the ports.

**View logs?**
```bash
docker-compose logs -f
```

## For AI Agents / Cursor

All commands support `--json` flag for machine-readable output:

```bash
npm run cli -- list --json
npm run cli -- info test-project --json
```

This makes it easy to parse in scripts or AI workflows.

