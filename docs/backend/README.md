# Backend Services

The TensorNode backend is a Python Flask-based API server that orchestrates the entire decentralized AI network. It manages virtual machines, handles validation requests, integrates with blockchain services, and provides a comprehensive REST API for frontend and external integrations.

## Architecture Overview

The backend follows a modular, service-oriented architecture:

```
backend/
├── server.py              # Main Flask application
├── fluence/               # VM management services
│   └── vm.py             # Fluence API integration
├── utils/                # Utility modules
│   ├── __init__.py
│   └── docker_setup.py   # Docker orchestration
├── keys/                 # SSH keys for VM access
│   ├── fluence           # Private key
│   └── fluence.pub       # Public key
├── scripts/              # Automation scripts
│   ├── create_tao_token.py
│   └── mint_tao_daily.py
├── vm_deployments.json   # Deployment tracking
└── requirements.txt      # Python dependencies
```

## Core Services

### 1. VM Management Service
Handles the complete lifecycle of virtual machines:

```python
class FluenceVMManager:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("FLUENCE_API_KEY")
        self.base_url = "https://api.fluence.dev/vms/v3"
    
    def deploy_vm(self, request_body: dict | None = None, wallet_address: str | None = None) -> dict:
        """Deploy a new VM with optional wallet association"""
        
    def list_vms(self) -> list:
        """Get all active VMs"""
        
    def update_vms(self, updates: list[dict]) -> None:
        """Update VM configurations"""
        
    def delete_vms(self, vm_ids: list[str]) -> None:
        """Delete multiple VMs"""
        
    def execute_on_vm(self, vm_id: str, command: str, key_path: str = "keys/fluence", username: str = "ubuntu") -> int:
        """Execute shell command on VM via SSH"""
        
    def upload_file(self, vm_id: str, local_path: str, remote_path: str, key_path: str = "keys/fluence", username: str = "ubuntu") -> int:
        """Upload file to VM via SCP"""
```

### 2. Validation Service
Manages the network validation process:

```python
@app.route("/validator", methods=["POST"])
def validator():
    """
    Process validation requests:
    1. Distribute queries to active miners
    2. Collect and score responses
    3. Submit results to blockchain
    4. Return aggregated scores
    """
    data = request.get_json(force=True) or {}
    user_input = data.get("input")
    truth = data.get("truth")
    vms = data.get("vms", [])
    
    # Query each VM
    for vm in vms:
        api_url = f"http://{vm['publicIp']}:3000/api/chat"
        response = requests.post(api_url, json={"prompt": user_input}, timeout=30)
        vm["validator"] = {"response": response.json()}
    
    # Score responses
    pairs = _parse_messages_to_pairs([{"message": json.dumps(data)}])
    for pair in pairs:
        pair["score"] = _openai_score_answer(
            question=pair.get("question", ""),
            truth=pair.get("truth", ""),
            candidate=pair.get("candidate", "")
        )
    
    # Submit to blockchain
    topic_id = submit_to_hedera_topic(data)
    
    return jsonify({"topicId": topic_id})
```

### 3. Scoring Engine
Advanced AI-powered response evaluation:

```python
def _openai_score_answer(question: str, truth: str, candidate: str) -> int:
    """
    Score candidate answer against ground truth using multiple strategies:
    1. LLM-based evaluation for semantic understanding
    2. Numeric comparison for mathematical questions
    3. Lexical similarity for text matching
    """
    try:
        # Use OpenAI for semantic scoring
        if os.getenv("OPENAI_API_KEY"):
            return _llm_score(question, truth, candidate)
        else:
            return _heuristic_score(truth, candidate)
    except Exception:
        return _fallback_score(truth, candidate)

def _llm_score(question: str, truth: str, candidate: str) -> int:
    """Use LLM for sophisticated scoring"""
    system_prompt = (
        "You are a strict evaluator. Compare the candidate answer to the ground truth. "
        "Score 0-100 (integer). Penalize irrelevance and hallucinations. "
        "IMPORTANT: Respond with ONLY the integer (0-100)."
    )
    
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"},
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Question: {question}\nTruth: {truth}\nCandidate: {candidate}"}
            ],
            "temperature": 0.0
        }
    )
    
    # Extract numeric score from response
    content = response.json()["choices"][0]["message"]["content"]
    match = re.search(r"\b(100|[1-9]?\d)\b", content)
    return int(match.group(1)) if match else 0

def _heuristic_score(truth: str, candidate: str) -> int:
    """Fallback scoring using heuristics"""
    # Numeric comparison for math questions
    truth_nums = re.findall(r"-?\d+", truth or "")
    candidate_nums = re.findall(r"-?\d+", candidate or "")
    
    if truth_nums:
        matched = sum(1 for n in truth_nums if n in candidate_nums)
        return int(100 * matched / len(truth_nums))
    
    # Lexical similarity for text
    truth_words = set((truth or "").lower().split())
    candidate_words = set((candidate or "").lower().split())
    
    if truth_words:
        overlap = len(truth_words & candidate_words)
        return int(100 * overlap / len(truth_words))
    
    return 0
```

### 4. Deployment Management
Tracks and manages VM deployments:

```python
def load_deployments() -> list[dict]:
    """Load deployment history from JSON file"""
    if os.path.exists(DEPLOYMENTS_FILE):
        with open(DEPLOYMENTS_FILE, "r") as f:
            return json.load(f)
    return []

def save_deployments(items: list[dict]) -> None:
    """Save deployment history to JSON file"""
    with open(DEPLOYMENTS_FILE, "w") as f:
        json.dump(items, f, indent=2)

def allocate_vm_to_miner(miner_address: str, instance_name: str, manager: FluenceVMManager) -> dict:
    """
    Allocate VM to miner:
    1. Try to reuse inactive VM
    2. Create new VM if none available
    3. Update deployment records
    """
    deployments = load_deployments()
    
    # Try to reuse inactive VM
    for record in deployments:
        if record.get("status") == "inactive":
            record.update({
                "status": "active",
                "minerAddress": miner_address,
                "instanceName": instance_name,
                "assignedAt": datetime.utcnow().isoformat()
            })
            save_deployments(deployments)
            return record
    
    # Create new VM if none available
    deploy_result = manager.deploy_vm()
    new_record = {
        "vmId": extract_vm_id(deploy_result),
        "status": "active",
        "minerAddress": miner_address,
        "instanceName": instance_name,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    deployments.append(new_record)
    save_deployments(deployments)
    return new_record
```

## API Endpoints

### VM Management Endpoints

#### Deploy VM
```python
@app.route("/deploy", methods=["POST"])
def deploy():
    """Deploy new VM with optional wallet association"""
    manager = create_manager()
    body = request.get_json(silent=True) or {}
    wallet_address = body.get("walletAddress")
    
    result = manager.deploy_vm(body, wallet_address=wallet_address)
    record_new_vms_as_inactive(result, wallet_address)
    
    return jsonify(result), 201
```

#### List VMs
```python
@app.route("/vms", methods=["GET"])
def list_vms():
    """Get all active VMs with wallet information"""
    vms = get_active_vms()
    
    # Merge with deployment records for wallet info
    deployments = load_deployments()
    index = {r["vmId"]: r for r in deployments}
    
    augmented_vms = []
    for vm in vms:
        vm_id = vm.get("id") or vm.get("vmId")
        record = index.get(vm_id, {})
        
        # Merge VM data with deployment record
        augmented_vm = {**vm, **record}
        augmented_vms.append(augmented_vm)
    
    return jsonify(augmented_vms)
```

#### Execute Command
```python
@app.route("/vms/<vm_id>/exec", methods=["POST"])
def exec_on_vm(vm_id: str):
    """Execute shell command on VM via SSH"""
    manager = create_manager()
    data = request.get_json(force=True)
    
    command = data.get("command")
    key_path = data.get("key_path", "keys/fluence")
    username = data.get("username", "ubuntu")
    
    exit_code = manager.execute_on_vm(vm_id, command, key_path, username)
    return jsonify({"exit_code": exit_code})
```

### Docker Management Endpoints

#### Deploy from URL
```python
@app.route("/vms/<vm_id>/docker/url", methods=["POST"])
def docker_from_url(vm_id: str):
    """Deploy Docker container from Dockerfile URL"""
    manager = create_manager()
    data = request.get_json(force=True)
    
    dockerfile_url = data.get("dockerfile_url")
    workdir = data.get("workdir", "ubuntu-docker")
    
    # Build Docker setup command
    cmd = build_docker_setup_command(dockerfile_url, workdir=workdir)
    
    # Execute on VM
    exit_code = manager.execute_on_vm(vm_id, cmd)
    return jsonify({"exit_code": exit_code})
```

#### Deploy from Local File
```python
@app.route("/vms/<vm_id>/docker/local", methods=["POST"])
def docker_from_local(vm_id: str):
    """Deploy Docker container from uploaded Dockerfile"""
    manager = create_manager()
    
    if "file" not in request.files:
        return jsonify({"error": "File required"}), 400
    
    file = request.files["file"]
    remote_dir = request.form.get("remote_dir", "ubuntu-docker")
    exposed_port = int(request.form.get("port", 3000))
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        file.save(tmp.name)
        temp_path = tmp.name
    
    try:
        # Inject GitHub token if available
        if os.getenv("GITHUB_TOKEN"):
            inject_github_token(temp_path)
        
        # Upload to VM
        remote_path = f"~/{remote_dir}/Dockerfile"
        upload_code = manager.upload_file(vm_id, temp_path, remote_path)
        
        if upload_code != 0:
            return jsonify({"error": "Upload failed"}), 400
        
        # Build and run Docker container
        cmd = build_docker_setup_from_local(remote_dir, exposed_port)
        exit_code = manager.execute_on_vm(vm_id, cmd)
        
        return jsonify({"exit_code": exit_code})
    
    finally:
        os.remove(temp_path)
```

### Blockchain Integration

#### Topic Management
```python
def _submit_scores_to_topic(topic_id: str, scores_payload: dict) -> dict:
    """Submit scores to Hedera topic via Next.js API"""
    try:
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        response = requests.post(
            f"{base_url}/api/topic/submit",
            json={
                "topicId": topic_id,
                "message": json.dumps(scores_payload)
            },
            timeout=30
        )
        return response.json() if response.ok else {"error": response.text}
    except Exception as e:
        return {"error": str(e)}

def _fetch_topic_messages(topic_id: str, limit: int = 100, order: str = "asc") -> list[dict]:
    """Fetch messages from Hedera topic"""
    try:
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        response = requests.get(
            f"{base_url}/api/topic/messages",
            params={"topicId": topic_id, "limit": limit, "order": order},
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            return data.get("data", {}).get("messages", [])
        return []
    except Exception:
        return []
```

## Docker Orchestration

### Docker Setup Utilities

```python
# utils/docker_setup.py

def build_docker_setup_command(dockerfile_url: str, workdir: str = "ubuntu-docker") -> str:
    """Build command to setup Docker from URL"""
    return f"""
    set -e
    mkdir -p ~/{workdir}
    cd ~/{workdir}
    curl -o Dockerfile "{dockerfile_url}"
    sudo docker build -t my-ubuntu-image .
    sudo docker run -d --name my-ubuntu-container -p 3000:3000 my-ubuntu-image
    """

def build_docker_setup_from_local(remote_dockerfile_dir: str, exposed_port: int = 3000) -> str:
    """Build command to setup Docker from local Dockerfile"""
    return f"""
    set -e
    cd ~/{remote_dockerfile_dir}
    sudo docker build -t my-ubuntu-image .
    sudo docker run -d --name my-ubuntu-container -p {exposed_port}:{exposed_port} my-ubuntu-image
    """

def build_docker_stop_command(container_name: str = "my-ubuntu-container") -> str:
    """Build command to stop Docker container"""
    return f"""
    sudo docker stop {container_name} || true
    sudo docker rm {container_name} || true
    """
```

### Container Health Monitoring

```python
def check_container_health(vm_id: str, port: int = 3000) -> dict:
    """Check if container is healthy and responding"""
    try:
        vm = get_vm_by_id(vm_id)
        public_ip = vm.get("publicIp")
        
        if not public_ip:
            return {"healthy": False, "error": "No public IP"}
        
        # Check health endpoint
        health_url = f"http://{public_ip}:{port}/health"
        response = requests.get(health_url, timeout=10)
        
        if response.ok:
            return {"healthy": True, "status": response.json()}
        else:
            return {"healthy": False, "status_code": response.status_code}
    
    except Exception as e:
        return {"healthy": False, "error": str(e)}
```

## Error Handling and Logging

### Comprehensive Error Handling

```python
import logging
from functools import wraps

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('tensornode.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def handle_errors(f):
    """Decorator for consistent error handling"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.error(f"Validation error in {f.__name__}: {e}")
            return jsonify({"error": "Invalid input", "details": str(e)}), 400
        except requests.RequestException as e:
            logger.error(f"External API error in {f.__name__}: {e}")
            return jsonify({"error": "External service unavailable"}), 502
        except Exception as e:
            logger.error(f"Unexpected error in {f.__name__}: {e}")
            return jsonify({"error": "Internal server error"}), 500
    
    return decorated_function

# Usage
@app.route("/vms", methods=["GET"])
@handle_errors
def list_vms():
    # Function implementation
    pass
```

### Request Validation

```python
from marshmallow import Schema, fields, validate, ValidationError

class VMDeploymentSchema(Schema):
    walletAddress = fields.Str(validate=validate.Regexp(r'^0\.0\.\d+$'))
    vmConfiguration = fields.Dict(missing=dict)
    instanceName = fields.Str(validate=validate.Length(min=1, max=50))

def validate_request(schema_class):
    """Decorator for request validation"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            schema = schema_class()
            try:
                data = request.get_json(force=True)
                validated_data = schema.load(data)
                return f(validated_data, *args, **kwargs)
            except ValidationError as e:
                return jsonify({"error": "Validation failed", "details": e.messages}), 400
        return decorated_function
    return decorator

# Usage
@app.route("/deploy", methods=["POST"])
@validate_request(VMDeploymentSchema)
def deploy(validated_data):
    # Use validated_data instead of request.get_json()
    pass
```

## Performance Optimization

### Caching Layer

```python
import redis
import json
from functools import wraps

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True
)

def cache_result(ttl=300):
    """Cache function results in Redis"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Create cache key
            cache_key = f"{f.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached_result = redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
            
            # Execute function and cache result
            result = f(*args, **kwargs)
            redis_client.setex(cache_key, ttl, json.dumps(result))
            return result
        
        return decorated_function
    return decorator

# Usage
@cache_result(ttl=60)  # Cache for 1 minute
def get_active_vms():
    # Expensive API call
    return fetch_vms_from_fluence()
```

### Async Processing

```python
import threading
from queue import Queue
import time

# Task queue for background processing
task_queue = Queue()

def background_worker():
    """Background worker for async tasks"""
    while True:
        try:
            task = task_queue.get(timeout=1)
            if task is None:
                break
            
            task_type = task.get("type")
            task_data = task.get("data")
            
            if task_type == "vm_health_check":
                check_vm_health(task_data["vm_id"])
            elif task_type == "cleanup_deployments":
                cleanup_old_deployments()
            
            task_queue.task_done()
        
        except Exception as e:
            logger.error(f"Background task error: {e}")

# Start background worker
worker_thread = threading.Thread(target=background_worker, daemon=True)
worker_thread.start()

def schedule_task(task_type: str, data: dict):
    """Schedule background task"""
    task_queue.put({"type": task_type, "data": data})
```

## Security Features

### API Rate Limiting

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per hour", "100 per minute"]
)

@app.route("/deploy", methods=["POST"])
@limiter.limit("10 per minute")
def deploy():
    # Deployment logic
    pass
```

### Input Sanitization

```python
import bleach
import re

def sanitize_input(text: str) -> str:
    """Sanitize user input"""
    # Remove HTML tags
    text = bleach.clean(text, tags=[], strip=True)
    
    # Remove potentially dangerous characters
    text = re.sub(r'[<>"\']', '', text)
    
    # Limit length
    return text[:1000]

def validate_vm_id(vm_id: str) -> bool:
    """Validate VM ID format"""
    return bool(re.match(r'^vm_[a-zA-Z0-9]{12}$', vm_id))
```

### SSH Key Management

```python
import os
import stat
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

def generate_ssh_keypair(key_path: str):
    """Generate SSH key pair for VM access"""
    # Generate private key
    private_key = ed25519.Ed25519PrivateKey.generate()
    
    # Serialize private key
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Serialize public key
    public_key = private_key.public_key()
    public_ssh = public_key.public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH
    )
    
    # Save keys
    with open(key_path, 'wb') as f:
        f.write(private_pem)
    os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)  # 600
    
    with open(f"{key_path}.pub", 'wb') as f:
        f.write(public_ssh)
```

## Monitoring and Health Checks

### Health Check Endpoint

```python
@app.route("/health", methods=["GET"])
def health_check():
    """Comprehensive health check"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {}
    }
    
    # Check Fluence API
    try:
        manager = create_manager()
        manager.list_vms()
        health_status["services"]["fluence"] = "healthy"
    except Exception as e:
        health_status["services"]["fluence"] = f"unhealthy: {e}"
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        redis_client.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {e}"
        health_status["status"] = "degraded"
    
    # Check external APIs
    try:
        requests.get("https://api.openai.com/v1/models", timeout=5)
        health_status["services"]["openai"] = "healthy"
    except Exception as e:
        health_status["services"]["openai"] = f"unhealthy: {e}"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return jsonify(health_status), status_code
```

### Metrics Collection

```python
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
VM_DEPLOYMENTS = Counter('vm_deployments_total', 'Total VM deployments')
VALIDATION_REQUESTS = Counter('validation_requests_total', 'Total validation requests')

@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    # Record metrics
    duration = time.time() - request.start_time
    REQUEST_DURATION.observe(duration)
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.endpoint or 'unknown',
        status=response.status_code
    ).inc()
    
    return response

@app.route("/metrics")
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}
```

## Configuration Management

### Environment Configuration

```python
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    # Flask settings
    flask_env: str = os.getenv("FLASK_ENV", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    port: int = int(os.getenv("PORT", "8000"))
    
    # External APIs
    fluence_api_key: Optional[str] = os.getenv("FLUENCE_API_KEY")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    github_token: Optional[str] = os.getenv("GITHUB_TOKEN")
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///tensornode.db")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Blockchain
    hedera_network: str = os.getenv("HEDERA_NETWORK", "testnet")
    hedera_operator_id: Optional[str] = os.getenv("HEDERA_OPERATOR_ID")
    hedera_operator_key: Optional[str] = os.getenv("HEDERA_OPERATOR_KEY")
    
    # Application
    next_api_base_url: str = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
    master_score_topic: str = os.getenv("MASTER_SCORE_TOPIC", "0.0.6916998")

# Global config instance
config = Config()
```

---

The TensorNode backend provides a robust, scalable foundation for the decentralized AI network. Its modular architecture, comprehensive error handling, and extensive feature set make it capable of handling the complex requirements of a distributed system while maintaining reliability and performance.
