# REST API Reference

The TensorNode REST API provides programmatic access to all network functionality including VM management, validation services, and blockchain interactions. This comprehensive reference covers all available endpoints, request/response formats, and usage examples.

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://api.tensornode.com`

## Authentication

Most endpoints require authentication through one of these methods:

### 1. Wallet Signature Authentication
```http
Authorization: Bearer <wallet_signature>
X-Account-ID: 0.0.123456
```

### 2. API Key Authentication
```http
X-API-Key: your_api_key_here
```

## Rate Limiting

API requests are rate-limited to prevent abuse:
- **Authenticated users**: 1000 requests/hour
- **Unauthenticated users**: 100 requests/hour
- **Burst limit**: 10 requests/second

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "vmId",
      "reason": "VM ID is required"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## VM Management Endpoints

### Deploy VM

Create and deploy a new virtual machine.

```http
POST /deploy
```

**Request Body:**
```json
{
  "walletAddress": "0.0.123456",
  "vmConfiguration": {
    "name": "my-miner-vm",
    "basicConfiguration": "cpu-4-ram-8gb-storage-25gb",
    "maxTotalPricePerEpochUsd": "1.5",
    "openPorts": [
      {"port": 22, "protocol": "tcp"},
      {"port": 3000, "protocol": "tcp"}
    ]
  }
}
```

**Response:**
```json
{
  "deployment": {
    "vmId": "vm_abc123def456",
    "status": "deploying",
    "estimatedReadyTime": "2024-01-15T10:35:00Z"
  },
  "walletAddress": "0.0.123456",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### List VMs

Retrieve all active virtual machines.

```http
GET /vms
```

**Query Parameters:**
- `status` (optional): Filter by VM status (`active`, `inactive`, `deploying`)
- `walletAddress` (optional): Filter by wallet address
- `limit` (optional): Maximum number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
[
  {
    "id": "vm_abc123def456",
    "name": "my-miner-vm",
    "publicIp": "192.168.1.100",
    "status": "active",
    "ports": [
      {"port": 22, "protocol": "tcp"},
      {"port": 3000, "protocol": "tcp"}
    ],
    "walletAddress": "0.0.123456",
    "minerAddress": "0.0.123456",
    "createdAt": "2024-01-15T10:30:00Z",
    "lastSeen": "2024-01-15T11:00:00Z"
  }
]
```

### Get VM Details

Retrieve detailed information about a specific VM.

```http
GET /vms/{vmId}
```

**Path Parameters:**
- `vmId`: The unique VM identifier

**Response:**
```json
{
  "id": "vm_abc123def456",
  "name": "my-miner-vm",
  "publicIp": "192.168.1.100",
  "status": "active",
  "ports": [
    {"port": 22, "protocol": "tcp"},
    {"port": 3000, "protocol": "tcp"}
  ],
  "configuration": {
    "cpu": 4,
    "memory": "8GB",
    "storage": "25GB",
    "osImage": "ubuntu-20.04"
  },
  "walletAddress": "0.0.123456",
  "minerAddress": "0.0.123456",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastSeen": "2024-01-15T11:00:00Z",
  "metrics": {
    "uptime": "99.9%",
    "requestsProcessed": 1250,
    "averageResponseTime": "150ms"
  }
}
```

### Update VM

Update VM configuration such as name or open ports.

```http
PATCH /vms
```

**Request Body:**
```json
{
  "updates": [
    {
      "id": "vm_abc123def456",
      "vmName": "updated-miner-vm",
      "openPorts": [
        {"port": 22, "protocol": "tcp"},
        {"port": 3000, "protocol": "tcp"},
        {"port": 8080, "protocol": "tcp"}
      ]
    }
  ]
}
```

**Response:**
```http
HTTP/1.1 204 No Content
```

### Delete VMs

Delete one or more virtual machines.

```http
DELETE /vms
```

**Request Body:**
```json
{
  "vmIds": ["vm_abc123def456", "vm_def789ghi012"]
}
```

**Response:**
```http
HTTP/1.1 204 No Content
```

### Allocate VM

Allocate an existing inactive VM to a miner.

```http
POST /allocate
```

**Request Body:**
```json
{
  "minerAddress": "0.0.123456",
  "instanceName": "my-allocated-vm"
}
```

**Response:**
```json
{
  "vmId": "vm_abc123def456",
  "vmName": "my-allocated-vm",
  "status": "active",
  "minerAddress": "0.0.123456",
  "assignedAt": "2024-01-15T10:30:00Z"
}
```

## VM Operations Endpoints

### Execute Command

Execute a shell command on a VM via SSH.

```http
POST /vms/{vmId}/exec
```

**Request Body:**
```json
{
  "command": "docker ps -a",
  "username": "ubuntu",
  "key_path": "keys/fluence"
}
```

**Response:**
```json
{
  "exit_code": 0,
  "output": "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS   PORTS   NAMES\nabc123def456   my-model  python    2 hours   Up       3000    my-container"
}
```

### Upload File

Upload a file to a VM.

```http
POST /vms/{vmId}/upload
```

**Request Body:** (multipart/form-data)
- `file`: The file to upload
- `remote_path`: Target path on the VM
- `username`: SSH username (default: ubuntu)
- `key_path`: SSH key path (default: keys/fluence)

**Response:**
```json
{
  "exit_code": 0,
  "remote_path": "/home/ubuntu/uploads/model.py"
}
```

### Deploy Docker from URL

Deploy a Docker container from a Dockerfile URL.

```http
POST /vms/{vmId}/docker/url
```

**Request Body:**
```json
{
  "dockerfile_url": "https://raw.githubusercontent.com/user/repo/main/Dockerfile",
  "workdir": "ubuntu-docker",
  "username": "ubuntu"
}
```

**Response:**
```json
{
  "exit_code": 0,
  "deployment_id": "deploy_123456"
}
```

### Deploy Docker from Local File

Deploy a Docker container from an uploaded Dockerfile.

```http
POST /vms/{vmId}/docker/local
```

**Request Body:** (multipart/form-data)
- `file`: Dockerfile to upload
- `remote_dir`: Remote directory name (default: ubuntu-docker)
- `port`: Exposed port (default: 3000)
- `username`: SSH username (default: ubuntu)

**Response:**
```json
{
  "exit_code": 0,
  "deployment_id": "deploy_123456"
}
```

### Stop Docker Container

Stop a running Docker container on a VM.

```http
POST /vms/{vmId}/docker/stop
```

**Request Body:**
```json
{
  "container_name": "my-ubuntu-container",
  "username": "ubuntu"
}
```

**Response:**
```json
{
  "exit_code": 0
}
```

## Validation Endpoints

### Submit Validation Request

Submit a query for validation across the network.

```http
POST /validator
```

**Request Body:**
```json
{
  "input": "What is the capital of France?",
  "truth": "Paris",
  "subnet": "llm",
  "vms": [
    {
      "id": "vm_abc123def456",
      "publicIp": "192.168.1.100",
      "wallet": "0.0.123456"
    }
  ],
  "accountId": "0.0.validator_account"
}
```

**Response:**
```json
{
  "topicId": "0.0.789012",
  "submissionId": "val_123456789",
  "estimatedCompletionTime": "2024-01-15T10:35:00Z"
}
```

## Blockchain Integration Endpoints

### Instance Registry

These endpoints interact with the Instance Registry smart contract.

#### Register Instance

```http
POST /api/instance-registry/register-instance
```

**Request Body:**
```json
{
  "contractId": "0.0.contract_id",
  "subnetId": 1,
  "minerAddress": "0.0.123456",
  "state": true,
  "url": "http://192.168.1.100:3000"
}
```

#### Get Active Instances by Subnet

```http
GET /api/instance-registry/get-active-by-subnet?subnetId=1&contractId=0.0.contract_id
```

#### Get All Subnets

```http
GET /api/instance-registry/get-all-subnets?contractId=0.0.contract_id
```

### Token Operations

#### Create Token

```http
POST /api/token/create
```

**Request Body:**
```json
{
  "name": "TensorNode Token",
  "symbol": "TNODE",
  "contractId": "0.0.token_contract"
}
```

#### Mint Tokens

```http
POST /api/token/mint
```

**Request Body:**
```json
{
  "amount": 1000,
  "contractId": "0.0.token_contract"
}
```

#### Transfer Tokens

```http
POST /api/token/transfer
```

**Request Body:**
```json
{
  "recipients": ["0.0.123456", "0.0.789012"],
  "amounts": [100, 200],
  "contractId": "0.0.token_contract"
}
```

### Topic Messaging

#### Create Topic

```http
POST /api/topic/create
```

**Request Body:** (text/plain)
```
{"type": "validation", "data": {...}}
```

#### Submit Message

```http
POST /api/topic/submit
```

**Request Body:**
```json
{
  "topicId": "0.0.789012",
  "message": "{\"type\": \"response\", \"data\": {...}}"
}
```

#### Get Messages

```http
GET /api/topic/messages?topicId=0.0.789012&limit=50&order=desc
```

**Response:**
```json
{
  "data": {
    "messages": [
      {
        "message": "{\"type\": \"response\", \"data\": {...}}",
        "timestamp": "2024-01-15T10:30:00Z",
        "sequenceNumber": 1
      }
    ]
  }
}
```

## Agent Endpoints

### Chat with Agent

Interact with the AI agent system.

```http
POST /api/agent
```

**Request Body:**
```json
{
  "input": "Deploy a new VM for LLM inference",
  "messages": [
    {
      "role": "user",
      "content": "Previous conversation context"
    }
  ]
}
```

**Response:**
```json
{
  "mode": "human",
  "network": "testnet",
  "result": {
    "response": "I'll help you deploy a new VM...",
    "actions": [
      {
        "type": "vm_deployment",
        "status": "initiated",
        "vmId": "vm_new123456"
      }
    ]
  }
}
```

## Wallet Integration

### Prepare Transaction

Prepare a transaction for wallet signing.

```http
POST /api/wallet/prepare
```

**Request Body:**
```json
{
  "type": "contract_call",
  "contractId": "0.0.123456",
  "functionName": "registerInstance",
  "parameters": [1, "0.0.miner", true, "http://vm.example.com"]
}
```

**Response:**
```json
{
  "transactionBytes": "0x1234567890abcdef...",
  "transactionId": "0.0.123456@1640995200.123456789",
  "estimatedFee": "0.05"
}
```

## WebSocket API

For real-time updates, connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};

// Subscribe to VM updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'vm_updates',
  vmId: 'vm_abc123def456'
}));
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TensorNodeClient } from '@tensornode/sdk';

const client = new TensorNodeClient({
  baseUrl: 'http://localhost:8000',
  apiKey: 'your_api_key'
});

// Deploy a VM
const deployment = await client.deployVM({
  walletAddress: '0.0.123456',
  vmConfiguration: {
    name: 'my-miner',
    basicConfiguration: 'cpu-4-ram-8gb-storage-25gb'
  }
});

// List VMs
const vms = await client.listVMs();

// Submit validation
const validation = await client.submitValidation({
  input: 'What is 2+2?',
  truth: '4',
  subnet: 'llm'
});
```

### Python

```python
from tensornode import TensorNodeClient

client = TensorNodeClient(
    base_url='http://localhost:8000',
    api_key='your_api_key'
)

# Deploy a VM
deployment = client.deploy_vm(
    wallet_address='0.0.123456',
    vm_configuration={
        'name': 'my-miner',
        'basicConfiguration': 'cpu-4-ram-8gb-storage-25gb'
    }
)

# List VMs
vms = client.list_vms()

# Submit validation
validation = client.submit_validation(
    input='What is 2+2?',
    truth='4',
    subnet='llm'
)
```

### cURL Examples

```bash
# Deploy VM
curl -X POST http://localhost:8000/deploy \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0.0.123456"}'

# List VMs
curl http://localhost:8000/vms

# Submit validation
curl -X POST http://localhost:8000/validator \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is 2+2?",
    "truth": "4",
    "subnet": "llm",
    "vms": []
  }'
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Pagination
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## API Versioning

The API uses URL versioning:
- Current version: `v1` (default)
- Access specific version: `/api/v1/vms`
- Version header: `Accept: application/vnd.tensornode.v1+json`

## Testing

Use the provided test endpoints to verify your integration:

```http
GET /health
```

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "blockchain": "healthy",
    "vm_manager": "healthy"
  }
}
```

---

This API reference provides comprehensive coverage of all TensorNode endpoints. For additional examples and integration guides, see the [SDK documentation](../development/sdk.md) and [integration examples](../development/examples.md).
