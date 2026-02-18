# Ments — Full-Scale AWS Deployment Guide

Complete guide to hosting Ments on AWS for production scale with no serverless timeouts, full control, and horizontal scaling.

---

## Why Move from Vercel to AWS?

| Issue on Vercel | AWS Solution |
|----------------|-------------|
| 10s function timeout (Hobby) / 60s (Pro) | No timeout limits on ECS/EC2 |
| Cold starts on serverless | Always-running containers |
| Limited compute for ML pipeline | Any instance size (GPU optional) |
| No background jobs | ECS tasks, SQS workers, cron via EventBridge |
| Single region (unless Enterprise) | Multi-region with CloudFront + Route 53 |
| No WebSocket support | ALB + ECS supports persistent connections |
| Vendor lock-in | Full infrastructure control |

---

## Architecture Overview

```
                         ┌─────────────────────┐
                         │    Route 53 (DNS)    │
                         │  ments.app → CF      │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   CloudFront (CDN)   │
                         │  Static assets cache │
                         │  SSL termination     │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │  S3 Bucket │  │    ALB     │  │  S3 Bucket │
              │  (Static)  │  │ (API/SSR)  │  │  (Media)   │
              └───────────┘  └─────┬─────┘  └───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │  ECS Task  │ │  ECS Task  │ │  ECS Task  │
              │  (Next.js) │ │  (Next.js) │ │  (Next.js) │
              │  Container │ │  Container │ │  Container │
              └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
        ┌─────▼─────┐     ┌──────▼──────┐     ┌──────▼──────┐
        │  RDS       │     │ ElastiCache  │     │    SQS      │
        │ PostgreSQL │     │   (Redis)    │     │  (Queues)   │
        │  (Primary) │     │  Feed Cache  │     │ Feed Jobs   │
        │     +      │     │  Sessions    │     │ ML Pipeline │
        │  Read      │     └─────────────┘     └──────┬──────┘
        │  Replicas  │                                │
        └───────────┘                          ┌──────▼──────┐
                                               │  ECS Worker  │
                                               │  (Background │
                                               │   Jobs)      │
                                               └─────────────┘
```

---

## AWS Services Needed

### Core Services

| Service | Purpose | Estimated Cost |
|---------|---------|---------------|
| **ECS Fargate** | Run Next.js containers (auto-scaling) | $30-100/mo |
| **ALB** | Load balancer for ECS tasks | $20/mo + traffic |
| **RDS PostgreSQL** | Primary database (replaces Supabase DB) | $30-200/mo |
| **ElastiCache Redis** | Feed cache, sessions, rate limiting | $15-50/mo |
| **S3** | Static assets, media uploads | $5-20/mo |
| **CloudFront** | CDN for static assets + API edge caching | $10-50/mo |
| **Route 53** | DNS management | $0.50/mo |
| **ECR** | Docker container registry | $1-5/mo |
| **SQS** | Job queues (feed computation, topic extraction) | $1-5/mo |
| **EventBridge** | Cron jobs (profile recomputation, analytics) | $1/mo |
| **Secrets Manager** | API keys, DB credentials | $2/mo |
| **CloudWatch** | Logging + monitoring + alerts | $5-20/mo |

**Estimated Total: $120-480/month** (scales with traffic)

### Optional (for scale)

| Service | Purpose | When to Add |
|---------|---------|-------------|
| **Aurora PostgreSQL** | Auto-scaling serverless DB | 100K+ users |
| **SageMaker** | ML model training + hosting | When adding ML models |
| **OpenSearch** | Full-text search, vector search | When adding search/embeddings |
| **API Gateway + Lambda** | Lightweight API endpoints | For webhooks, cron triggers |
| **WAF** | Web application firewall | Before launch |
| **Cognito** | Auth (if replacing Supabase Auth) | If fully migrating off Supabase |

---

## Option A: Keep Supabase DB + Host App on AWS (Recommended Start)

Easiest migration — keep Supabase for database/auth, move only the Next.js app to AWS.

### Step 1: Dockerize the Next.js App

Create `Dockerfile` in `ments_web_app/`:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for env vars needed at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Update `next.config.ts` to enable standalone output:

```typescript
const nextConfig = {
  output: 'standalone',
  // ... existing config
};
```

### Step 2: Push to ECR (Elastic Container Registry)

```bash
# Create ECR repository
aws ecr create-repository --repository-name ments-web --region ap-south-1

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Build and push
docker build -t ments-web \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your-url \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  .

docker tag ments-web:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest
```

### Step 3: Create ECS Cluster + Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name ments-cluster --region ap-south-1

# Create task definition (save as task-def.json)
```

**task-def.json:**
```json
{
  "family": "ments-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "ments-web",
      "image": "<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "SUPABASE_SERVICE_ROLE_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:ments/supabase-service-role-key"
        },
        {
          "name": "GROQ_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:ments/groq-api-key"
        },
        {
          "name": "NEXT_PUBLIC_SUPABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:ments/supabase-url"
        },
        {
          "name": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:ments/supabase-anon-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ments-web",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-def.json

# Create ALB, target group, and ECS service (via AWS Console or CLI)
```

### Step 4: Create ALB (Application Load Balancer)

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name ments-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --region ap-south-1

# Create target group
aws elbv2 create-target-group \
  --name ments-web-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --target-type ip \
  --health-check-path /api/health \
  --region ap-south-1
```

### Step 5: Create ECS Service with Auto-Scaling

```bash
aws ecs create-service \
  --cluster ments-cluster \
  --service-name ments-web \
  --task-definition ments-web \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:...,containerName=ments-web,containerPort=3000" \
  --region ap-south-1
```

Auto-scaling policy:
```bash
# Scale based on CPU utilization
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/ments-cluster/ments-web \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/ments-cluster/ments-web \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

### Step 6: CloudFront + Custom Domain

```bash
# Create CloudFront distribution pointing to ALB
# Configure:
# - Origin: ALB DNS name
# - Behaviors: /api/* → no cache, /* → cache static
# - SSL certificate from ACM
# - Custom domain: ments.app
```

### Step 7: Add Health Check Endpoint

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

---

## Option B: Full AWS Migration (Maximum Scale)

Move everything off Supabase to AWS-native services.

### Database: RDS PostgreSQL → Aurora

```bash
# Create Aurora PostgreSQL cluster
aws rds create-db-cluster \
  --db-cluster-identifier ments-db \
  --engine aurora-postgresql \
  --engine-version 15.4 \
  --master-username ments_admin \
  --master-user-password <SECURE_PASSWORD> \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name ments-db-subnet \
  --region ap-south-1

# Create primary instance
aws rds create-db-instance \
  --db-instance-identifier ments-db-primary \
  --db-cluster-identifier ments-db \
  --db-instance-class db.r6g.large \
  --engine aurora-postgresql \
  --region ap-south-1

# Create read replica (for feed queries)
aws rds create-db-instance \
  --db-instance-identifier ments-db-reader \
  --db-cluster-identifier ments-db \
  --db-instance-class db.r6g.medium \
  --engine aurora-postgresql \
  --region ap-south-1
```

### Cache: ElastiCache Redis

Replace Supabase table-based feed cache with Redis:

```bash
aws elasticache create-replication-group \
  --replication-group-id ments-redis \
  --replication-group-description "Ments feed cache" \
  --engine redis \
  --cache-node-type cache.r6g.medium \
  --num-cache-clusters 2 \
  --region ap-south-1
```

**Redis cache structure:**
```
feed:{userId}          → JSON string of ranked post IDs + scores (TTL: 2hr)
profile:{userId}       → JSON string of user interest profile (TTL: 1hr)
session:{sessionId}    → Session data (TTL: 30min)
rate:{userId}:feed     → Rate limit counter (TTL: 1min)
```

### Background Workers: SQS + ECS

For heavy computation (feed pipeline, topic extraction, profile recomputation):

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ API Route │────►│   SQS    │────►│  ECS Worker  │
│ (trigger) │     │  Queue   │     │  (process)   │
└──────────┘     └──────────┘     └──────────────┘
```

**Queue definitions:**
```bash
# Feed computation queue
aws sqs create-queue --queue-name ments-feed-compute --region ap-south-1

# Topic extraction queue
aws sqs create-queue --queue-name ments-topic-extract --region ap-south-1

# Profile recomputation queue
aws sqs create-queue --queue-name ments-profile-compute --region ap-south-1
```

**Worker ECS task:**
- Polls SQS queues
- Processes feed pipeline jobs (no timeout limits)
- Writes results to Redis cache + RDS
- Can run on larger instances (2 vCPU, 4GB RAM)

### Auth: AWS Cognito (replacing Supabase Auth)

```bash
aws cognito-idp create-user-pool \
  --pool-name ments-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true}}' \
  --region ap-south-1
```

### File Storage: S3 + CloudFront

```bash
# Media uploads bucket
aws s3 mb s3://ments-media-uploads --region ap-south-1

# Configure CORS for direct uploads
aws s3api put-bucket-cors --bucket ments-media-uploads --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["https://ments.app"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'
```

### Real-time: AWS AppSync or API Gateway WebSockets

Replace Supabase Realtime with AWS-native WebSockets:

```
Client ←──WebSocket──→ API Gateway (WebSocket) ←──→ Lambda ←──→ DynamoDB (connections)
                                                        ↑
                                                    EventBridge (new post events)
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: ments-web
  ECS_CLUSTER: ments-cluster
  ECS_SERVICE: ments-web

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            --build-arg NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }} \
            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }} \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

---

## Scaling Strategy

### Traffic Tiers

| Users | ECS Tasks | RDS Instance | Redis | Est. Cost |
|-------|-----------|-------------|-------|-----------|
| 0-1K DAU | 2 tasks (0.5 vCPU, 1GB) | db.t4g.micro | cache.t4g.micro | $80/mo |
| 1K-10K DAU | 2-4 tasks (1 vCPU, 2GB) | db.r6g.medium | cache.r6g.medium | $250/mo |
| 10K-50K DAU | 4-8 tasks (2 vCPU, 4GB) | db.r6g.large + reader | cache.r6g.large | $600/mo |
| 50K-200K DAU | 8-20 tasks (2 vCPU, 4GB) | Aurora Serverless v2 | Redis cluster | $1500/mo |
| 200K+ DAU | 20+ tasks + workers | Aurora multi-region | Redis cluster | $3000+/mo |

### Auto-Scaling Triggers

| Metric | Scale Out | Scale In |
|--------|-----------|----------|
| CPU utilization | > 70% for 1 min | < 30% for 5 min |
| Request count | > 1000 req/min | < 200 req/min |
| Response latency | P95 > 2s | P95 < 500ms |
| Queue depth (SQS) | > 100 messages | < 10 messages |

---

## Monitoring & Alerts

### CloudWatch Dashboards

```bash
# Key metrics to monitor:
- ECS CPU/Memory utilization
- ALB request count, latency (P50, P95, P99)
- ALB 5xx error rate
- RDS connections, CPU, read/write IOPS
- Redis memory usage, cache hit rate
- SQS queue depth, processing time
- Feed pipeline duration (custom metric)
- Feed source distribution (pipeline vs cache vs chronological)
```

### CloudWatch Alarms

```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name ments-5xx-errors \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:ap-south-1:<ACCOUNT_ID>:ments-alerts

# High latency
aws cloudwatch put-metric-alarm \
  --alarm-name ments-high-latency \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --statistic p95 \
  --period 300 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:ap-south-1:<ACCOUNT_ID>:ments-alerts
```

---

## Migration Checklist

### Phase 1: App on AWS, DB on Supabase (Week 1)

- [ ] Create AWS account + configure IAM
- [ ] Create VPC with public + private subnets in ap-south-1
- [ ] Create ECR repository
- [ ] Add `Dockerfile` + `output: 'standalone'` to Next.js config
- [ ] Build and push Docker image to ECR
- [ ] Create ECS cluster + task definition + service
- [ ] Create ALB + target group + security groups
- [ ] Store secrets in AWS Secrets Manager
- [ ] Create health check endpoint
- [ ] Test: app running on ALB DNS
- [ ] Add CloudFront distribution
- [ ] Point custom domain via Route 53
- [ ] Set up GitHub Actions CI/CD
- [ ] Set up CloudWatch logging + alarms

### Phase 2: Add Redis Cache (Week 2)

- [ ] Create ElastiCache Redis cluster
- [ ] Update `cache-manager.ts` to use Redis instead of Supabase table
- [ ] Update `interest-profile.ts` to use Redis for in-memory cache
- [ ] Add session storage to Redis
- [ ] Test: feed pipeline uses Redis cache

### Phase 3: Background Workers (Week 3)

- [ ] Create SQS queues for feed jobs
- [ ] Create worker ECS task definition
- [ ] Move feed pipeline computation to background worker
- [ ] API route triggers SQS job, polls for result
- [ ] Topic extraction runs async via SQS
- [ ] Profile recomputation runs on schedule via EventBridge
- [ ] Test: feed computation happens in background, no API timeout

### Phase 4: Full DB Migration (Week 4+, optional)

- [ ] Create Aurora PostgreSQL cluster
- [ ] Run schema migrations on Aurora
- [ ] Migrate data from Supabase to Aurora (pg_dump/pg_restore)
- [ ] Update connection strings
- [ ] Replace Supabase Auth with Cognito (large effort)
- [ ] Replace Supabase Realtime with API Gateway WebSockets
- [ ] Test: full stack on AWS

---

## Quick Start: Minimum Viable AWS Deploy

If you want the fastest path to AWS (just to fix the Vercel timeout issue):

### 1. Install AWS CLI + configure

```bash
aws configure
# Enter: Access Key, Secret Key, Region: ap-south-1, Output: json
```

### 2. Use AWS App Runner (simplest — no Docker needed)

```bash
# App Runner auto-builds from source code
aws apprunner create-service \
  --service-name ments-web \
  --source-configuration '{
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/YOUR_ORG/mentsweb",
      "SourceCodeVersion": { "Type": "BRANCH", "Value": "main" },
      "CodeConfiguration": {
        "ConfigurationSource": "API",
        "CodeConfigurationValues": {
          "Runtime": "NODEJS_18",
          "BuildCommand": "cd ments_web_app && npm ci && npm run build",
          "StartCommand": "cd ments_web_app && npm start",
          "Port": "3000",
          "RuntimeEnvironmentVariables": {
            "NEXT_PUBLIC_SUPABASE_URL": "your-url",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
            "GROQ_API_KEY": "your-groq-key"
          }
        }
      }
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "1024",
    "Memory": "2048"
  }' \
  --region ap-south-1
```

**App Runner advantages:**
- No Docker needed (builds from source)
- No timeout limits
- Auto-scales 1-25 instances
- Built-in HTTPS + custom domain
- ~$25-50/month for low traffic
- Deploy in 5 minutes

This is the fastest way to get the feed engine working on AWS without Vercel's timeout limitations. Start here, then migrate to ECS Fargate when you need more control.

---

## Cost Comparison

| | Vercel Pro | AWS App Runner | AWS ECS (full) |
|--|-----------|---------------|----------------|
| Monthly cost | $20 + usage | $25-50 | $120-480 |
| Function timeout | 60s | No limit | No limit |
| Scaling | Auto | Auto (1-25) | Auto (custom) |
| Custom domain | Yes | Yes | Yes |
| Background jobs | No | No | Yes (SQS workers) |
| Redis cache | No | No (add separately) | Yes |
| Complexity | Low | Low | High |
| Best for | < 10K DAU | 10K-50K DAU | 50K+ DAU |
