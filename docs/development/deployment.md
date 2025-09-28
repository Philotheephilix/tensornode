# Production Deployment Guide

This comprehensive guide covers deploying TensorNode to production environments, including cloud providers, containerization, monitoring, and security best practices.

## Deployment Architecture

### Production Architecture Overview

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX/Cloudflare]
    end
    
    subgraph "Frontend Tier"
        F1[Next.js Instance 1]
        F2[Next.js Instance 2]
        F3[Next.js Instance 3]
    end
    
    subgraph "Backend Tier"
        B1[Flask API 1]
        B2[Flask API 2]
        B3[Flask API 3]
    end
    
    subgraph "Database Tier"
        DB[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end
    
    subgraph "External Services"
        HEDERA[Hedera Network]
        FLUENCE[Fluence VMs]
        AI[AI Providers]
    end
    
    LB --> F1
    LB --> F2
    LB --> F3
    
    F1 --> B1
    F2 --> B2
    F3 --> B3
    
    B1 --> DB
    B2 --> DB
    B3 --> DB
    
    B1 --> REDIS
    B2 --> REDIS
    B3 --> REDIS
    
    B1 --> HEDERA
    B2 --> FLUENCE
    B3 --> AI
```

## Cloud Provider Setup

### AWS Deployment

#### 1. Infrastructure Setup

**VPC and Networking:**
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=tensornode-vpc}]'

# Create subnets
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Create internet gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=tensornode-igw}]'
```

**Security Groups:**
```bash
# Web tier security group
aws ec2 create-security-group \
  --group-name tensornode-web \
  --description "TensorNode Web Tier" \
  --vpc-id vpc-xxxxx

# Allow HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

#### 2. ECS Deployment

**Task Definition:**
```json
{
  "family": "tensornode-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "your-account.dkr.ecr.us-east-1.amazonaws.com/tensornode-frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NEXT_PUBLIC_BACKEND_BASE_URL",
          "value": "https://api.tensornode.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/tensornode-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Service Definition:**
```json
{
  "serviceName": "tensornode-frontend",
  "cluster": "tensornode-cluster",
  "taskDefinition": "tensornode-frontend:1",
  "desiredCount": 3,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxxxx", "subnet-yyyyy"],
      "securityGroups": ["sg-xxxxx"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:account:targetgroup/tensornode-frontend/xxxxx",
      "containerName": "frontend",
      "containerPort": 3000
    }
  ]
}
```

#### 3. RDS Setup

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier tensornode-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username tensornode \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name tensornode-db-subnet-group
```

### Google Cloud Platform

#### 1. GKE Deployment

**Cluster Setup:**
```bash
# Create GKE cluster
gcloud container clusters create tensornode-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10
```

**Kubernetes Manifests:**
```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tensornode-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tensornode-frontend
  template:
    metadata:
      labels:
        app: tensornode-frontend
    spec:
      containers:
      - name: frontend
        image: gcr.io/your-project/tensornode-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_BACKEND_BASE_URL
          value: "https://api.tensornode.com"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: tensornode-frontend-service
spec:
  selector:
    app: tensornode-frontend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Azure Deployment

#### 1. Container Instances

```bash
# Create resource group
az group create --name tensornode-rg --location eastus

# Create container instance
az container create \
  --resource-group tensornode-rg \
  --name tensornode-frontend \
  --image your-registry.azurecr.io/tensornode-frontend:latest \
  --cpu 2 \
  --memory 4 \
  --ports 3000 \
  --environment-variables \
    NEXT_PUBLIC_BACKEND_BASE_URL=https://api.tensornode.com
```

## Docker Configuration

### Production Dockerfiles

**Frontend Dockerfile:**
```dockerfile
# Multi-stage build for Next.js
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**Backend Dockerfile:**
```dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "server.py"]
```

### Docker Compose for Production

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./nextjs
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_BACKEND_BASE_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/tensornode
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=tensornode
      - POSTGRES_USER=tensornode
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Load Balancing and Reverse Proxy

### NGINX Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }
    
    upstream backend {
        server backend:8000;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;
    
    server {
        listen 80;
        server_name tensornode.com www.tensornode.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name tensornode.com www.tensornode.com;
        
        ssl_certificate /etc/nginx/ssl/tensornode.com.crt;
        ssl_certificate_key /etc/nginx/ssl/tensornode.com.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
        
        # Frontend
        location / {
            limit_req zone=web burst=20 nodelay;
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket support
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

### Cloudflare Configuration

```yaml
# cloudflare-config.yaml
rules:
  - description: "Rate limit API endpoints"
    expression: '(http.request.uri.path matches "^/api/")'
    action: "rate_limit"
    rate_limit:
      threshold: 100
      period: 60
      
  - description: "Cache static assets"
    expression: '(http.request.uri.path matches "\\.(css|js|png|jpg|jpeg|gif|ico|svg)$")'
    action: "cache"
    cache:
      cache_level: "cache_everything"
      edge_cache_ttl: 86400
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d tensornode.com -d www.tensornode.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom SSL Certificate

```bash
# Generate private key
openssl genrsa -out tensornode.com.key 2048

# Generate certificate signing request
openssl req -new -key tensornode.com.key -out tensornode.com.csr

# Generate self-signed certificate (for testing)
openssl x509 -req -days 365 -in tensornode.com.csr -signkey tensornode.com.key -out tensornode.com.crt
```

## Environment Configuration

### Production Environment Variables

**Frontend (.env.production):**
```env
NODE_ENV=production
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_BACKEND_BASE_URL=https://api.tensornode.com
NEXT_PUBLIC_WC_PROJECT_ID=your_production_project_id
NEXT_PUBLIC_INSTANCE_REGISTRY_CONTRACT_ID=0.0.production_contract
```

**Backend (production.env):**
```env
FLASK_ENV=production
DATABASE_URL=postgresql://user:pass@db.tensornode.com:5432/tensornode
REDIS_URL=redis://redis.tensornode.com:6379
FLUENCE_API_KEY=your_production_fluence_key
OPENAI_API_KEY=your_production_openai_key
HEDERA_OPERATOR_ID=0.0.production_account
HEDERA_OPERATOR_KEY=your_production_private_key
```

### Secrets Management

#### AWS Secrets Manager

```python
import boto3
import json

def get_secret(secret_name, region_name="us-east-1"):
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )
    
    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise e
    
    secret = get_secret_value_response['SecretString']
    return json.loads(secret)

# Usage
secrets = get_secret("tensornode/production")
FLUENCE_API_KEY = secrets['FLUENCE_API_KEY']
```

#### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tensornode-secrets
type: Opaque
data:
  fluence-api-key: <base64-encoded-key>
  openai-api-key: <base64-encoded-key>
  hedera-private-key: <base64-encoded-key>
```

## Database Setup

### PostgreSQL Configuration

```sql
-- Create database
CREATE DATABASE tensornode;

-- Create user
CREATE USER tensornode WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE tensornode TO tensornode;

-- Create tables
\c tensornode;

CREATE TABLE vm_deployments (
    id SERIAL PRIMARY KEY,
    vm_id VARCHAR(255) UNIQUE NOT NULL,
    vm_name VARCHAR(255),
    wallet_address VARCHAR(255),
    miner_address VARCHAR(255),
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE validation_results (
    id SERIAL PRIMARY KEY,
    topic_id VARCHAR(255),
    validator_address VARCHAR(255),
    query TEXT,
    truth TEXT,
    scores JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vm_deployments_wallet ON vm_deployments(wallet_address);
CREATE INDEX idx_vm_deployments_status ON vm_deployments(status);
CREATE INDEX idx_validation_results_topic ON validation_results(topic_id);
```

### Redis Configuration

```conf
# redis.conf
bind 0.0.0.0
port 6379
requirepass your_secure_redis_password

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

## Monitoring and Logging

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'tensornode-frontend'
    static_configs:
      - targets: ['frontend:3000']
    metrics_path: '/api/metrics'
    
  - job_name: 'tensornode-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "TensorNode Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### ELK Stack Configuration

**Logstash Configuration:**
```ruby
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "tensornode-backend" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "tensornode-%{+YYYY.MM.dd}"
  }
}
```

## Security Hardening

### Application Security

**1. Input Validation:**
```python
from marshmallow import Schema, fields, validate

class VMDeploymentSchema(Schema):
    wallet_address = fields.Str(required=True, validate=validate.Regexp(r'^0\.0\.\d+$'))
    vm_name = fields.Str(validate=validate.Length(min=1, max=50))
    instance_name = fields.Str(validate=validate.Length(min=1, max=50))
```

**2. Rate Limiting:**
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per hour"]
)

@app.route('/api/deploy', methods=['POST'])
@limiter.limit("10 per minute")
def deploy():
    # Deployment logic
    pass
```

**3. CORS Configuration:**
```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": ["https://tensornode.com", "https://www.tensornode.com"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

### Infrastructure Security

**1. Firewall Rules:**
```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**2. Fail2Ban Configuration:**
```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
```

## Backup and Disaster Recovery

### Database Backup

```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgresql"
DB_NAME="tensornode"

# Create backup
pg_dump -h localhost -U tensornode -d $DB_NAME > $BACKUP_DIR/tensornode_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/tensornode_$DATE.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/tensornode_$DATE.sql.gz s3://tensornode-backups/db/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Application Backup

```bash
#!/bin/bash
# backup-app.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/application"

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  /app/.env.production \
  /app/keys/ \
  /etc/nginx/nginx.conf

# Backup deployment history
cp /app/backend/vm_deployments.json $BACKUP_DIR/vm_deployments_$DATE.json

# Upload to S3
aws s3 sync $BACKUP_DIR s3://tensornode-backups/app/
```

### Disaster Recovery Plan

**1. Recovery Time Objectives (RTO):**
- Critical services: < 15 minutes
- Non-critical services: < 1 hour
- Full system recovery: < 4 hours

**2. Recovery Point Objectives (RPO):**
- Database: < 5 minutes (continuous replication)
- Application state: < 15 minutes (regular backups)
- Configuration: < 1 hour (version controlled)

**3. Recovery Procedures:**
```bash
#!/bin/bash
# disaster-recovery.sh

# 1. Restore database
psql -h new-db-host -U tensornode -d tensornode < latest_backup.sql

# 2. Deploy application
docker-compose -f docker-compose.prod.yml up -d

# 3. Restore configuration
tar -xzf config_backup.tar.gz -C /

# 4. Update DNS records
# (Manual process or automated with Route53)

# 5. Verify services
curl -f https://tensornode.com/health
```

## Performance Optimization

### Caching Strategy

**1. Redis Caching:**
```python
import redis
import json

redis_client = redis.Redis(host='redis', port=6379, db=0)

def cache_vm_list(vms, ttl=300):
    redis_client.setex('vm_list', ttl, json.dumps(vms))

def get_cached_vm_list():
    cached = redis_client.get('vm_list')
    return json.loads(cached) if cached else None
```

**2. CDN Configuration:**
```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.tensornode.com' 
    : '',
  images: {
    domains: ['cdn.tensornode.com'],
  },
}
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_vm_deployments_status_wallet 
ON vm_deployments(status, wallet_address);

CREATE INDEX CONCURRENTLY idx_validation_results_created_at 
ON validation_results(created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM vm_deployments 
WHERE status = 'active' AND wallet_address = '0.0.123456';
```

## Deployment Automation

### CI/CD Pipeline

**GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Build and push Docker images
        run: |
          docker build -t tensornode-frontend ./nextjs
          docker build -t tensornode-backend ./backend
          
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          
          docker tag tensornode-frontend:latest $ECR_REGISTRY/tensornode-frontend:latest
          docker tag tensornode-backend:latest $ECR_REGISTRY/tensornode-backend:latest
          
          docker push $ECR_REGISTRY/tensornode-frontend:latest
          docker push $ECR_REGISTRY/tensornode-backend:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster tensornode-cluster --service tensornode-frontend --force-new-deployment
          aws ecs update-service --cluster tensornode-cluster --service tensornode-backend --force-new-deployment
```

### Blue-Green Deployment

```bash
#!/bin/bash
# blue-green-deploy.sh

CURRENT_ENV=$(aws elbv2 describe-target-groups --names tensornode-current --query 'TargetGroups[0].TargetGroupArn' --output text)
NEW_ENV=$(aws elbv2 describe-target-groups --names tensornode-staging --query 'TargetGroups[0].TargetGroupArn' --output text)

# Deploy to staging environment
docker-compose -f docker-compose.staging.yml up -d

# Health check
for i in {1..30}; do
  if curl -f https://staging.tensornode.com/health; then
    echo "Staging environment is healthy"
    break
  fi
  sleep 10
done

# Switch traffic
aws elbv2 modify-listener --listener-arn $LISTENER_ARN --default-actions Type=forward,TargetGroupArn=$NEW_ENV

# Verify deployment
sleep 30
if curl -f https://tensornode.com/health; then
  echo "Deployment successful"
  # Clean up old environment
  docker-compose -f docker-compose.prod.yml down
else
  echo "Deployment failed, rolling back"
  aws elbv2 modify-listener --listener-arn $LISTENER_ARN --default-actions Type=forward,TargetGroupArn=$CURRENT_ENV
fi
```

## Maintenance and Updates

### Rolling Updates

```bash
#!/bin/bash
# rolling-update.sh

SERVICES=("frontend" "backend")

for service in "${SERVICES[@]}"; do
  echo "Updating $service..."
  
  # Update one instance at a time
  docker service update --image tensornode-$service:latest tensornode-$service
  
  # Wait for health check
  sleep 60
  
  # Verify service is healthy
  if ! curl -f https://tensornode.com/health; then
    echo "Health check failed for $service"
    exit 1
  fi
done

echo "Rolling update completed successfully"
```

### Database Migrations

```python
# migrations/001_initial_schema.py
def upgrade():
    """Create initial tables"""
    op.create_table(
        'vm_deployments',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('vm_id', sa.String(255), unique=True, nullable=False),
        sa.Column('wallet_address', sa.String(255)),
        sa.Column('status', sa.String(50), default='inactive'),
        sa.Column('created_at', sa.DateTime, default=sa.func.current_timestamp())
    )

def downgrade():
    """Drop tables"""
    op.drop_table('vm_deployments')
```

---

This deployment guide provides a comprehensive foundation for running TensorNode in production. Adapt the configurations to your specific requirements and always test thoroughly in staging environments before deploying to production.
