#!/bin/bash
set -e

echo "🚀 PocketBase Multi-Project Server Setup"
echo "========================================"
echo ""

# Check for required tools
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed."
        exit 1
    fi
    echo "✓ $1 found"
}

echo "Checking dependencies..."
check_dependency node
check_dependency npm
check_dependency docker
check_dependency docker-compose

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. Current: $(node -v)"
    exit 1
fi
echo "✓ Node.js version OK"

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi
echo "✓ Docker is running"

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Creating directories..."
mkdir -p data backups

echo ""
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp env.example .env
    echo "✓ Created .env file from template"
    echo "  Please edit .env to configure your settings"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "Building project..."
npm run build

echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Run 'npm run dev' for development"
echo "  3. Or run 'docker-compose up -d' for Docker"
echo ""
echo "Quick commands:"
echo "  npm run dev           - Start in development mode"
echo "  npm run cli create -i - Create a new project"
echo "  npm run cli list      - List all projects"
echo ""

