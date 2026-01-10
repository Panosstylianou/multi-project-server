# PocketBase Multi-Project Server

A multi-tenant PocketBase instance manager designed for software development agencies. Easily create, manage, and host multiple PocketBase databases for your client projects.

## Features

- 🚀 **Quick Project Creation** - Spin up new PocketBase instances in seconds
- 🔒 **Isolated Databases** - Each project runs in its own Docker container
- 🌐 **Automatic SSL** - Let's Encrypt certificates via Traefik
- 📦 **Automatic Backups** - Scheduled backups with S3 storage
- 🔧 **CLI Tool** - Full management via terminal (perfect for Cursor/AI agents)
- 🔌 **REST API** - Programmatic access to all features
- ☁️ **AWS Ready** - Terraform configuration for production deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Infrastructure                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    EC2 Instance (t3.small)                    │   │
│  │  ┌─────────────┐    ┌──────────────────────────────────────┐ │   │
│  │  │   Traefik   │────│         Docker Network                │ │   │
│  │  │   Reverse   │    │  ┌──────────┐ ┌──────────┐ ┌──────┐  │ │   │
│  │  │   Proxy     │    │  │ Manager  │ │ PB:      │ │ PB:  │  │ │   │
│  │  │   (SSL)     │    │  │   API    │ │ client-1 │ │ ...  │  │ │   │
│  │  └─────────────┘    │  └──────────┘ └──────────┘ └──────┘  │ │   │
│  │                     └──────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│  ┌─────────────────┐    ┌────┴────────────┐    ┌──────────────────┐ │
│  │   EBS Volume    │    │   S3 Backups    │    │    Route 53      │ │
│  │   (Data)        │    │                 │    │    (DNS)         │ │
│  └─────────────────┘    └─────────────────┘    └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/pocketbase-multi-project-server.git
cd pocketbase-multi-project-server

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Start in development mode
npm run dev

# Or use Docker
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Create Your First Project

**Using CLI:**
```bash
# Interactive mode
npm run cli create -i

# Or with parameters
npm run cli create --name "My Client App" --client "Acme Corp"
```

**Using API:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "name": "My Client App",
    "clientName": "Acme Corp",
    "clientEmail": "contact@acme.com"
  }'
```

## CLI Commands

```bash
# Project Management
pbm create [options]       # Create a new project
pbm list                   # List all projects
pbm info <project>         # Get project details
pbm start <project>        # Start a project
pbm stop <project>         # Stop a project
pbm restart <project>      # Restart a project
pbm delete <project>       # Delete a project
pbm logs <project>         # View project logs
pbm url <project>          # Get project URLs

# Backup Management
pbm backup create <project>              # Create backup
pbm backup list <project>                # List backups
pbm backup restore <project> <filename>  # Restore backup

# System
pbm init                   # Initialize the manager
pbm stats                  # Show statistics
```

## API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:id` | Get project details |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/start` | Start project |
| POST | `/api/projects/:id/stop` | Stop project |
| POST | `/api/projects/:id/restart` | Restart project |
| GET | `/api/projects/:id/logs` | Get logs |
| GET | `/api/projects/:id/backups` | List backups |
| POST | `/api/projects/:id/backups` | Create backup |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Full health check |
| GET | `/api/health/ready` | Readiness probe |
| GET | `/api/health/live` | Liveness probe |

## AWS Deployment

### Prerequisites

- AWS CLI configured
- Terraform >= 1.0
- Domain name (optional but recommended)

### Deploy

```bash
cd terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply
terraform apply
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `key_pair_name` | EC2 key pair for SSH access |
| `domain` | Base domain (e.g., pocketbase.youragency.com) |
| `api_key` | Secret API key for the management API |
| `admin_email` | Admin email for notifications |
| `acme_email` | Email for Let's Encrypt |

### Post-Deployment

After deployment, configure DNS:

```
A     pocketbase.youragency.com      -> <EC2_PUBLIC_IP>
A     *.pocketbase.youragency.com    -> <EC2_PUBLIC_IP>
```

Or if using Route53, set the `route53_zone_id` variable.

## GitHub Actions Setup

### Required Secrets

- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `API_KEY` - PocketBase manager API key

### Required Variables

- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_KEY_PAIR_NAME` - EC2 key pair name
- `DOMAIN` - Base domain
- `ADMIN_EMAIL` - Admin email
- `ACME_EMAIL` - Let's Encrypt email
- `PRODUCTION_INSTANCE_ID` - EC2 instance ID for production
- `STAGING_INSTANCE_ID` - EC2 instance ID for staging (optional)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `HOST` | 0.0.0.0 | API server host |
| `NODE_ENV` | development | Environment |
| `DOCKER_SOCKET` | /var/run/docker.sock | Docker socket path |
| `POCKETBASE_IMAGE` | ghcr.io/muchobien/pocketbase:latest | PocketBase Docker image |
| `DATA_DIR` | ./data | Data directory |
| `BACKUPS_DIR` | ./backups | Backups directory |
| `BASE_DOMAIN` | localhost | Base domain for projects |
| `USE_HTTPS` | false | Enable HTTPS |
| `API_KEY` | dev-api-key | API authentication key |
| `DEFAULT_MEMORY_LIMIT` | 256m | Default memory per instance |
| `DEFAULT_CPU_LIMIT` | 0.5 | Default CPU per instance |

## Cost Estimation

| Component | Monthly Cost (Est.) |
|-----------|-------------------|
| EC2 t3.small | ~$15 |
| EBS 50GB gp3 | ~$4 |
| S3 backups | ~$2-5 |
| Data transfer | ~$2-5 |
| **Total** | **~$23-29/month** |

With 10 client projects, that's ~$2.50/project/month for infrastructure.

## For AI Agents / Cursor

This project is designed to be easily managed by AI agents. Key points:

1. **CLI is JSON-friendly**: Use `--json` flag for machine-readable output
   ```bash
   pbm list --json
   pbm info my-project --json
   ```

2. **API is RESTful**: Standard HTTP methods and JSON responses

3. **Common workflows**:
   ```bash
   # Create a new project for a client
   pbm create --name "Client Website" --client "Client Name" --email "client@email.com"
   
   # Get project URL to use in frontend config
   pbm url client-website --api
   
   # Create backup before making changes
   pbm backup create client-website
   
   # Check project status
   pbm info client-website --json | jq '.status'
   ```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issue tracker.

