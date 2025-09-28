# Installation Guide

This comprehensive installation guide covers all aspects of setting up TensorNode for development, testing, and production environments.

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB
- **Storage**: 20 GB available space
- **Network**: Stable internet connection
- **OS**: Linux (Ubuntu 20.04+), macOS (10.15+), Windows 10+

### Recommended Requirements
- **CPU**: 4+ cores, 3.0 GHz
- **RAM**: 8+ GB
- **Storage**: 50+ GB SSD
- **Network**: High-speed internet (100+ Mbps)
- **OS**: Linux (Ubuntu 22.04 LTS)

## Prerequisites

### 1. Node.js and npm

**Linux/macOS:**
```bash
# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

**Windows:**
Download and install from [nodejs.org](https://nodejs.org/) or use Chocolatey:
```powershell
choco install nodejs
```

### 2. Python 3.9+

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install python3 python3-pip
```

**macOS:**
```bash
# Using Homebrew
brew install python@3.11
```

**Windows:**
Download from [python.org](https://python.org/) or use Chocolatey:
```powershell
choco install python
```

### 3. Docker

**Linux:**
```bash
# Ubuntu
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**macOS:**
Download Docker Desktop from [docker.com](https://docker.com/)

**Windows:**
Download Docker Desktop from [docker.com](https://docker.com/)

### 4. Git

**Linux:**
```bash
sudo apt install git  # Ubuntu/Debian
sudo yum install git  # CentOS/RHEL
```

**macOS:**
```bash
brew install git
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/)

## Installation Methods

### Method 1: Manual Installation (Recommended for Development)

#### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/tensornode.git
cd tensornode
```

#### Step 2: Frontend Setup

```bash
cd nextjs

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit configuration (see Configuration section below)
nano .env.local
```

#### Step 3: Backend Setup

```bash
cd ../backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# OR
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# If requirements.txt doesn't exist, install manually:
pip install flask flask-cors requests python-dotenv
```

#### Step 4: Smart Contracts Setup

```bash
cd ../hedera-contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### Method 2: Docker Installation (Recommended for Production)

#### Step 1: Clone and Configure

```bash
git clone https://github.com/your-org/tensornode.git
cd tensornode
```

#### Step 2: Create Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./nextjs
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_BASE_URL=http://backend:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - FLUENCE_API_KEY=${FLUENCE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./backend/keys:/app/keys

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

#### Step 3: Build and Run

```bash
# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Method 3: Automated Installation Script

```bash
#!/bin/bash
# install.sh - Automated TensorNode installation

set -e

echo "🚀 Installing TensorNode..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Clone repository
if [ ! -d "tensornode" ]; then
    git clone https://github.com/your-org/tensornode.git
fi
cd tensornode

# Setup frontend
echo "📦 Setting up frontend..."
cd nextjs
npm install
cp .env.local.example .env.local
cd ..

# Setup backend
echo "🐍 Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors requests python-dotenv
cd ..

# Setup contracts
echo "📜 Setting up smart contracts..."
cd hedera-contracts
npm install
npx hardhat compile
cd ..

echo "✅ Installation complete!"
echo "📖 Next steps:"
echo "1. Configure environment variables in nextjs/.env.local"
echo "2. Set up your Fluence API key"
echo "3. Run 'npm run dev' in the nextjs directory"
echo "4. Run 'python server.py' in the backend directory"
```

Make it executable and run:
```bash
chmod +x install.sh
./install.sh
```

## Configuration

### Frontend Configuration (.env.local)

```env
# Network Configuration
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_AGENT_MODE=human

# Hedera Configuration
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
HEDERA_OPERATOR_ID=0.0.your_account_id
HEDERA_OPERATOR_KEY=your_private_key_hex

# Backend Configuration
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000
NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID=0.0.contract_id

# AI Provider Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your_openai_key

# Optional: Alternative AI Providers
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your_anthropic_key
# AI_PROVIDER=groq
# GROQ_API_KEY=your_groq_key
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
```

### Backend Configuration

Set environment variables:

```bash
# Required
export FLUENCE_API_KEY=your_fluence_api_key
export OPENAI_API_KEY=your_openai_key

# Optional
export GITHUB_TOKEN=your_github_token
export NEXT_API_BASE_URL=http://localhost:3000
export MASTER_SCORE_TOPIC=0.0.topic_id
export PORT=8000
```

### Smart Contract Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.9",
  networks: {
    testnet: {
      url: "https://testnet.hashio.io/api",
      accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
      chainId: 296
    },
    mainnet: {
      url: "https://mainnet.hashio.io/api",
      accounts: [process.env.MAINNET_OPERATOR_PRIVATE_KEY],
      chainId: 295
    }
  }
};
```

## Service Configuration

### 1. Fluence VM Setup

1. Sign up for Fluence account at [fluence.dev](https://fluence.dev)
2. Generate API key from dashboard
3. Set `FLUENCE_API_KEY` environment variable

### 2. Hedera Account Setup

1. Create testnet account at [portal.hedera.com](https://portal.hedera.com)
2. Fund account with testnet HBAR
3. Generate ECDSA private key
4. Set account ID and private key in configuration

### 3. WalletConnect Setup

1. Create project at [walletconnect.com](https://walletconnect.com)
2. Get project ID
3. Set `NEXT_PUBLIC_WC_PROJECT_ID` in frontend configuration

### 4. AI Provider Setup

Choose one or more AI providers:

**OpenAI:**
1. Create account at [openai.com](https://openai.com)
2. Generate API key
3. Set `OPENAI_API_KEY`

**Anthropic:**
1. Create account at [anthropic.com](https://anthropic.com)
2. Generate API key
3. Set `ANTHROPIC_API_KEY`

**Groq:**
1. Create account at [groq.com](https://groq.com)
2. Generate API key
3. Set `GROQ_API_KEY`

## Verification

### 1. Frontend Verification

```bash
cd nextjs
npm run dev
```

Visit `http://localhost:3000` and verify:
- ✅ Page loads without errors
- ✅ Wallet connection works
- ✅ Navigation between pages works

### 2. Backend Verification

```bash
cd backend
python server.py
```

Test endpoints:
```bash
# Health check
curl http://localhost:8000/vms

# Should return JSON array of VMs
```

### 3. Smart Contract Verification

```bash
cd hedera-contracts
npx hardhat test
```

Should show all tests passing.

### 4. Integration Test

1. Start both frontend and backend
2. Connect wallet
3. Navigate to Miner page
4. Try creating a VM
5. Check that VM appears in the list

## Troubleshooting

### Common Issues

**Node.js Version Conflicts:**
```bash
# Use nvm to manage versions
nvm install 20
nvm use 20
```

**Python Virtual Environment Issues:**
```bash
# Recreate virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
```

**Docker Permission Issues (Linux):**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Port Already in Use:**
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Environment Variable Issues:**
```bash
# Check if variables are set
echo $FLUENCE_API_KEY
# Source environment file
source .env
```

### Log Locations

- **Frontend**: Browser console and terminal
- **Backend**: Terminal output and `backend/logs/`
- **Docker**: `docker-compose logs`

### Getting Help

If you encounter issues:

1. Check the [troubleshooting guide](advanced/troubleshooting.md)
2. Search existing [GitHub issues](https://github.com/your-org/tensornode/issues)
3. Join our [Discord community](https://discord.gg/tensornode)
4. Create a new issue with detailed error information

## Next Steps

After successful installation:

1. **Configuration**: Complete the [configuration guide](development/environment.md)
2. **Development**: Set up your [development environment](development/setup.md)
3. **Deployment**: Learn about [production deployment](development/deployment.md)
4. **Usage**: Follow the [user guides](guides/miner.md) for your role

## Updates and Maintenance

### Updating TensorNode

```bash
# Pull latest changes
git pull origin main

# Update frontend dependencies
cd nextjs
npm install

# Update backend dependencies
cd ../backend
source venv/bin/activate
pip install -r requirements.txt

# Update contracts
cd ../hedera-contracts
npm install
npx hardhat compile
```

### Backup and Recovery

Important files to backup:
- Environment configuration files
- SSH keys in `backend/keys/`
- Deployment history in `backend/vm_deployments.json`
- Wallet private keys (store securely!)

---

*Installation complete! You're now ready to participate in the TensorNode network.* 🎉
