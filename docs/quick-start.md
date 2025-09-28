# Quick Start Guide

Get up and running with TensorNode in under 10 minutes! This guide will help you set up your first node and start participating in the network.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed on your system
- **Python 3.9+** for backend services
- **Docker** for containerized deployments
- **Git** for cloning repositories
- **Hedera Testnet Account** with some HBAR for transactions

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/tensornode.git
cd tensornode
```

## Step 2: Environment Setup

### Frontend Configuration

1. Navigate to the Next.js frontend:
```bash
cd nextjs
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Create environment configuration:
```bash
cp .env.local.example .env.local
```

4. Edit `.env.local` with your configuration:
```env
# Network Configuration
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_AGENT_MODE=human

# Hedera Configuration
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
HEDERA_OPERATOR_ID=0.0.your_account_id
HEDERA_OPERATOR_KEY=your_private_key

# Backend Configuration
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000
NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID=0.0.contract_id

# AI Provider (choose one)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
# OR
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
```

### Backend Configuration

1. Navigate to the backend directory:
```bash
cd ../backend
```

2. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install flask flask-cors requests python-dotenv
```

4. Set up environment variables:
```bash
export FLUENCE_API_KEY=your_fluence_api_key
export GITHUB_TOKEN=your_github_token  # Optional
export OPENAI_API_KEY=your_openai_key  # For scoring
```

## Step 3: Deploy Smart Contracts (Optional)

If you want to deploy your own contracts:

```bash
cd ../hedera-contracts
npm install
npx hardhat compile
npx hardhat deploy-contract --network testnet
```

## Step 4: Start the Services

### Start Backend Server

```bash
cd backend
python server.py
```

The backend will start on `http://localhost:8000`

### Start Frontend Application

In a new terminal:
```bash
cd nextjs
npm run dev
```

The frontend will start on `http://localhost:3000`

## Step 5: Connect Your Wallet

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Connect Wallet" in the top navigation
3. Choose your preferred Hedera wallet (HashPack, Blade, etc.)
4. Approve the connection request

## Step 6: Choose Your Role

### Option A: Become a Miner

1. Navigate to the **Miner** page
2. Click "Create & Deploy" to set up your first VM
3. Upload a Dockerfile or provide a URL to your AI model
4. Wait for deployment to complete
5. Your miner will automatically register with the network

### Option B: Become a Validator

1. Navigate to the **Validator** page
2. Enter your account ID
3. Submit a test query with expected answer
4. The system will automatically score miner responses
5. View results and scores in real-time

### Option C: Manage Subnets

1. Navigate to the **Subnet** page
2. View available node types (LLM, Vision, etc.)
3. Create and manage VM instances
4. Monitor network performance

## Step 7: Test Your Setup

### Test Miner Functionality

```bash
# Test your miner's API endpoint
curl -X POST http://your-vm-ip:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!", "temperature": 0.2}'
```

### Test Validator Functionality

1. Go to the Validator page
2. Enter a simple query: "What is 2+2?"
3. Enter expected answer: "4"
4. Submit and watch the scoring process

### Test API Integration

```bash
# List active VMs
curl http://localhost:8000/vms

# Deploy a new VM
curl -X POST http://localhost:8000/deploy \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0.0.your_account"}'
```

## Common Issues and Solutions

### Port Conflicts
If you encounter port conflicts:
- Frontend: Change port with `npm run dev -- -p 3001`
- Backend: Set `PORT=8001` environment variable

### Wallet Connection Issues
- Ensure your wallet extension is installed and unlocked
- Check that you're on the correct network (testnet/mainnet)
- Verify your account has sufficient HBAR balance

### VM Deployment Failures
- Check your Fluence API key is valid
- Ensure Docker is running on your system
- Verify network connectivity to Fluence services

### Environment Variable Issues
- Double-check all required environment variables are set
- Ensure no trailing spaces or quotes in values
- Restart services after changing environment variables

## Next Steps

Now that you have TensorNode running locally, explore these advanced features:

### For Miners
- [Deploy Custom AI Models](guides/miner.md#custom-models)
- [Optimize Performance](advanced/performance.md)
- [Monitor Earnings](guides/miner.md#earnings)

### For Validators
- [Advanced Scoring Techniques](guides/validator.md#scoring)
- [Batch Validation](guides/validator.md#batch-operations)
- [Quality Metrics](guides/validator.md#metrics)

### For Developers
- [API Integration](api/rest-api.md)
- [WebSocket Usage](api/websocket.md)
- [Smart Contract Interaction](api/smart-contracts.md)

## Production Deployment

Ready for production? Check out our [deployment guide](development/deployment.md) for:
- Cloud provider setup
- SSL certificate configuration
- Load balancing strategies
- Monitoring and logging
- Security best practices

## Getting Help

Need assistance? Here are your options:

- **Documentation**: Browse our comprehensive [docs](README.md)
- **GitHub Issues**: Report bugs or request features
- **Discord**: Join our community for real-time help
- **Telegram**: Connect with other developers
- **Email**: Contact our support team

## What's Next?

Continue your TensorNode journey:

1. **Deep Dive**: Read the [System Architecture](architecture/system-overview.md)
2. **Specialize**: Follow detailed [User Guides](guides/miner.md)
3. **Integrate**: Explore the [API Reference](api/rest-api.md)
4. **Contribute**: Check out [Development Setup](development/setup.md)

Welcome to the TensorNode network! 🚀
