# Miner Guide

Welcome to the TensorNode Miner Guide! This comprehensive guide will walk you through everything you need to know about becoming a successful miner in the TensorNode network.

## What is a Miner?

A miner in the TensorNode network is a participant who provides computational resources by deploying and running AI models on virtual machines. Miners earn rewards based on their performance, availability, and the quality of responses they provide to network queries.

## Getting Started

### Prerequisites

Before becoming a miner, ensure you have:

- **Hedera Wallet**: HashPack, Blade, or compatible wallet
- **HBAR Balance**: Sufficient for transaction fees (minimum 10 HBAR recommended)
- **Fluence Account**: Access to decentralized VM infrastructure
- **Technical Knowledge**: Basic understanding of Docker and AI models
- **Stable Internet**: Reliable high-speed connection

### Step 1: Set Up Your Environment

1. **Install TensorNode**:
   ```bash
   git clone https://github.com/your-org/tensornode.git
   cd tensornode
   ```

2. **Configure Environment**:
   ```bash
   cd nextjs
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start Services**:
   ```bash
   # Terminal 1: Backend
   cd backend
   python server.py
   
   # Terminal 2: Frontend
   cd nextjs
   npm run dev
   ```

### Step 2: Connect Your Wallet

1. Navigate to `http://localhost:3000`
2. Click "Connect Wallet" in the header
3. Select your preferred Hedera wallet
4. Approve the connection request
5. Verify your account ID appears in the interface

### Step 3: Access the Miner Interface

1. Click on the "Miner" tab in the navigation
2. You'll see the miner dashboard with:
   - Your current miner instances
   - VM creation and deployment tools
   - Performance metrics

## Deploying Your First Miner

### Option 1: Quick Deploy with Default Configuration

1. **Navigate to Miner Page**: Click the "Miner" tab
2. **Set Instance Name**: Enter a descriptive name (e.g., "llm-miner-1")
3. **Choose Deployment Method**: Select "Upload" or "URL"
4. **Provide AI Model**:
   - **Upload**: Select your Dockerfile
   - **URL**: Enter Dockerfile URL (e.g., from GitHub)
5. **Configure Port**: Set exposed port (default: 3000)
6. **Deploy**: Click "Create & Deploy"

### Option 2: Advanced Configuration

For more control over your deployment:

```json
{
  "constraints": {
    "basicConfiguration": "cpu-8-ram-16gb-storage-50gb",
    "maxTotalPricePerEpochUsd": "3.0"
  },
  "vmConfiguration": {
    "name": "high-performance-llm",
    "openPorts": [
      {"port": 22, "protocol": "tcp"},
      {"port": 3000, "protocol": "tcp"},
      {"port": 8080, "protocol": "tcp"}
    ]
  }
}
```

## AI Model Requirements

### Supported Model Types

TensorNode currently supports these AI model categories:

1. **Large Language Models (LLM)**
   - Text generation and completion
   - Question answering
   - Code generation
   - Conversational AI

2. **Computer Vision** (Coming Soon)
   - Image classification
   - Object detection
   - Image generation

3. **Speech Processing** (Coming Soon)
   - Speech-to-text transcription
   - Text-to-speech synthesis

4. **Translation** (Coming Soon)
   - Multi-language text translation
   - Real-time translation services

### Docker Configuration

Your AI model must be containerized with Docker. Here's a basic template:

```dockerfile
# Dockerfile for LLM Miner
FROM python:3.11-slim

# Install dependencies
RUN pip install torch transformers flask requests

# Copy model files
COPY model/ /app/model/
COPY api/ /app/api/
COPY requirements.txt /app/

# Install Python dependencies
WORKDIR /app
RUN pip install -r requirements.txt

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the model server
CMD ["python", "api/server.py"]
```

### API Interface Requirements

Your containerized model must expose a REST API with these endpoints:

#### Required Endpoints

**1. Chat Endpoint**
```http
POST /api/chat
Content-Type: application/json

{
  "prompt": "Your question here",
  "temperature": 0.2,
  "max_tokens": 150
}
```

**Response:**
```json
{
  "response": "Model's answer",
  "model": "your-model-name",
  "timestamp": "2024-01-15T10:30:00Z",
  "processing_time": 1.23
}
```

**2. Health Check Endpoint**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "uptime": "2h 15m 30s"
}
```

**3. Model Info Endpoint**
```http
GET /info
```

**Response:**
```json
{
  "model_name": "your-model-name",
  "model_type": "llm",
  "version": "1.0.0",
  "capabilities": ["text-generation", "qa"],
  "max_context_length": 4096
}
```

### Example Model Implementation

Here's a simple Flask-based model server:

```python
# api/server.py
from flask import Flask, request, jsonify
import time
import os
from transformers import AutoTokenizer, AutoModelForCausalLM

app = Flask(__name__)

# Load model (example with Hugging Face)
model_name = os.getenv("MODEL_NAME", "microsoft/DialoGPT-medium")
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 100)
        
        start_time = time.time()
        
        # Tokenize and generate
        inputs = tokenizer.encode(prompt, return_tensors='pt')
        outputs = model.generate(
            inputs,
            max_length=inputs.shape[1] + max_tokens,
            temperature=temperature,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response[len(prompt):].strip()
        
        processing_time = time.time() - start_time
        
        return jsonify({
            'response': response,
            'model': model_name,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'processing_time': round(processing_time, 2)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'uptime': '0h 0m 0s'  # Implement actual uptime tracking
    })

@app.route('/info', methods=['GET'])
def info():
    return jsonify({
        'model_name': model_name,
        'model_type': 'llm',
        'version': '1.0.0',
        'capabilities': ['text-generation'],
        'max_context_length': 1024
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
```

## Managing Your Miners

### Monitoring Performance

The miner dashboard provides real-time information about your instances:

- **VM Status**: Active, inactive, or deploying
- **Public IP**: External IP address for your VM
- **API Endpoint**: Direct link to your model's API
- **Uptime**: How long your miner has been running
- **Request Count**: Number of queries processed
- **Average Response Time**: Performance metric

### Scaling Your Operation

#### Horizontal Scaling
Deploy multiple miners to increase capacity:

```bash
# Deploy multiple instances
for i in {1..5}; do
  curl -X POST http://localhost:8000/deploy \
    -H "Content-Type: application/json" \
    -d "{\"walletAddress\": \"0.0.123456\"}"
done
```

#### Vertical Scaling
Upgrade VM specifications for better performance:

```json
{
  "constraints": {
    "basicConfiguration": "cpu-16-ram-32gb-storage-100gb",
    "maxTotalPricePerEpochUsd": "5.0"
  }
}
```

### Managing Costs

Monitor and control your operational costs:

1. **VM Pricing**: Check Fluence pricing for different configurations
2. **Usage Patterns**: Monitor when your miners are most active
3. **Auto-scaling**: Implement automatic scaling based on demand
4. **Resource Optimization**: Use appropriate VM sizes for your models

## Earning Rewards

### How Rewards Work

Miners earn rewards based on several factors:

1. **Response Quality**: Accuracy and relevance of AI responses
2. **Response Time**: How quickly you respond to queries
3. **Availability**: Uptime and reliability of your service
4. **Network Participation**: Active participation in validation

### Scoring System

The network uses an automated scoring system:

```python
# Scoring factors
score = (
    quality_score * 0.4 +      # 40% - Response accuracy
    speed_score * 0.3 +        # 30% - Response time
    availability_score * 0.2 + # 20% - Uptime
    participation_score * 0.1  # 10% - Network activity
)
```

### Maximizing Earnings

**1. Optimize Model Performance**
- Use efficient model architectures
- Implement response caching
- Optimize inference pipelines

**2. Maintain High Availability**
- Monitor VM health continuously
- Implement automatic restarts
- Use redundant deployments

**3. Improve Response Quality**
- Fine-tune models for specific domains
- Implement quality checks
- Use ensemble methods

**4. Participate Actively**
- Respond to validation requests promptly
- Maintain good network reputation
- Engage with community governance

## Troubleshooting

### Common Issues

**1. VM Deployment Fails**
```bash
# Check Fluence API key
echo $FLUENCE_API_KEY

# Verify account balance
# Check VM limits in Fluence dashboard
```

**2. Model Not Responding**
```bash
# Check container status
curl http://your-vm-ip:3000/health

# View container logs
ssh ubuntu@your-vm-ip "docker logs my-container"
```

**3. Low Scoring**
```bash
# Test your model locally
curl -X POST http://your-vm-ip:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test question", "temperature": 0.2}'

# Check response time
time curl http://your-vm-ip:3000/api/chat ...
```

**4. Connection Issues**
```bash
# Test SSH connectivity
ssh -i keys/fluence ubuntu@your-vm-ip

# Check open ports
nmap -p 22,3000 your-vm-ip
```

### Performance Optimization

**1. Model Optimization**
```python
# Use model quantization
from transformers import AutoModelForCausalLM
import torch

model = AutoModelForCausalLM.from_pretrained(
    "your-model",
    torch_dtype=torch.float16,  # Use half precision
    device_map="auto"           # Automatic device placement
)
```

**2. Caching Strategies**
```python
# Implement response caching
from functools import lru_cache

@lru_cache(maxsize=1000)
def generate_response(prompt, temperature, max_tokens):
    # Your model inference code here
    pass
```

**3. Batch Processing**
```python
# Process multiple requests together
def batch_inference(prompts, batch_size=4):
    results = []
    for i in range(0, len(prompts), batch_size):
        batch = prompts[i:i+batch_size]
        batch_results = model.generate_batch(batch)
        results.extend(batch_results)
    return results
```

### Monitoring and Alerts

Set up monitoring for your miners:

```python
# Simple health monitoring
import requests
import time

def monitor_miner(vm_ip, check_interval=60):
    while True:
        try:
            response = requests.get(f"http://{vm_ip}:3000/health", timeout=10)
            if response.status_code == 200:
                print(f"✅ Miner {vm_ip} is healthy")
            else:
                print(f"⚠️ Miner {vm_ip} returned {response.status_code}")
        except Exception as e:
            print(f"❌ Miner {vm_ip} is unreachable: {e}")
        
        time.sleep(check_interval)
```

## Advanced Topics

### Custom Model Integration

Integrate your own pre-trained models:

```python
# Custom model wrapper
class CustomModelWrapper:
    def __init__(self, model_path):
        self.model = self.load_model(model_path)
    
    def load_model(self, path):
        # Load your custom model
        pass
    
    def generate(self, prompt, **kwargs):
        # Implement your inference logic
        pass
```

### Multi-Model Deployment

Run multiple models on a single VM:

```python
# Multi-model server
models = {
    'llm': load_llm_model(),
    'vision': load_vision_model(),
    'translation': load_translation_model()
}

@app.route('/api/chat/<model_type>', methods=['POST'])
def chat_with_model(model_type):
    if model_type not in models:
        return jsonify({'error': 'Model not available'}), 404
    
    model = models[model_type]
    # Process request with specific model
```

### Automated Deployment

Automate your miner deployment process:

```bash
#!/bin/bash
# deploy-miner.sh

set -e

WALLET_ADDRESS="0.0.123456"
MODEL_NAME="my-llm-model"
INSTANCE_COUNT=3

for i in $(seq 1 $INSTANCE_COUNT); do
    echo "Deploying miner instance $i..."
    
    # Deploy VM
    VM_ID=$(curl -s -X POST http://localhost:8000/deploy \
        -H "Content-Type: application/json" \
        -d "{\"walletAddress\": \"$WALLET_ADDRESS\"}" | \
        jq -r '.deployment.vmId')
    
    echo "VM $VM_ID deployed, waiting for ready state..."
    
    # Wait for VM to be ready
    while true; do
        STATUS=$(curl -s http://localhost:8000/vms/$VM_ID | jq -r '.status')
        if [ "$STATUS" = "active" ]; then
            break
        fi
        sleep 30
    done
    
    # Deploy model
    curl -X POST http://localhost:8000/vms/$VM_ID/docker/url \
        -H "Content-Type: application/json" \
        -d "{\"dockerfile_url\": \"https://raw.githubusercontent.com/user/repo/main/Dockerfile\"}"
    
    echo "Miner instance $i deployed successfully!"
done
```

## Best Practices

### Security

1. **Keep SSH Keys Secure**: Store private keys safely
2. **Regular Updates**: Keep your models and dependencies updated
3. **Access Control**: Limit SSH access to your VMs
4. **Monitor Logs**: Watch for suspicious activity

### Performance

1. **Resource Monitoring**: Track CPU, memory, and disk usage
2. **Load Testing**: Test your models under various loads
3. **Optimization**: Continuously improve response times
4. **Scaling**: Plan for growth and increased demand

### Reliability

1. **Health Checks**: Implement comprehensive health monitoring
2. **Graceful Degradation**: Handle errors gracefully
3. **Backup Plans**: Have redundancy for critical miners
4. **Documentation**: Keep detailed operational documentation

## Community and Support

### Getting Help

- **Discord**: Join our miner community channel
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive guides and tutorials
- **Office Hours**: Weekly community calls

### Contributing

Help improve the TensorNode network:

- **Model Sharing**: Share high-quality models
- **Code Contributions**: Contribute to the codebase
- **Documentation**: Improve guides and tutorials
- **Testing**: Help test new features

### Staying Updated

- **Newsletter**: Subscribe for updates
- **GitHub**: Watch the repository for changes
- **Social Media**: Follow @TensorNode for announcements
- **Community Calls**: Join monthly network updates

---

Congratulations! You're now ready to become a successful TensorNode miner. Start with a simple deployment and gradually scale your operation as you gain experience. The network rewards quality and reliability, so focus on providing excellent AI services to maximize your earnings.

Happy mining! 🚀
