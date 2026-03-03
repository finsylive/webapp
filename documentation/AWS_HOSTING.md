# Hosting Ments on AWS — Full Scale Production Guide

## Why Move From Vercel to AWS

| Issue on Vercel | Solved on AWS |
|----------------|---------------|
| 10s function timeout (hobby) / 60s (pro) | No timeout — always-running containers |
| Cold starts on serverless | Warm containers with ECS Fargate |
| Limited compute for AI pipeline | Choose any instance size |
| No background jobs | ECS tasks, SQS workers, cron jobs |
| Expensive at scale ($20/user/month Pro) | Pay-per-use, ~70% cheaper at scale |
| Single region (unless Enterprise) | Multi-region from day one |

---

## Architecture Overview

```
                         ┌──────────────────────┐
                         │   AWS CloudFront CDN  │
                         │   (Global Edge Cache) │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │ Application Load      │
                         │ Balancer (ALB)        │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
            │  ECS Fargate │ │ ECS Fargate│ │ ECS Fargate │
            │  Container 1 │ │ Container 2│ │ Container N │
            │  (Next.js)   │ │ (Next.js)  │ │ (Next.js)   │
            └───────┬──────┘ └─────┬──────┘ └──────┬──────┘
                    │               │               │
         ┌──────────┼───────────────┼───────────────┼──────────┐
         │          │               │               │          │
    ┌────▼────┐ ┌───▼───┐  ┌───────▼──────┐ ┌─────▼────┐ ┌───▼───┐
    │Supabase │ │ Redis │  │   SQS Queue  │ │   S3     │ │ Groq  │
    │ Postgres│ │ElastiC│  │(Event Worker)│ │ (Media)  │ │  API  │
    └─────────┘ └───────┘  └──────┬───────┘ └──────────┘ └───────┘
                                  │
                           ┌──────▼───────┐
                           │ ECS Worker   │
                           │ (Background  │
                           │  Jobs)       │
                           └──────────────┘
```

---

## Option 1: AWS Amplify (Easiest Migration)

**Best for:** Quick migration from Vercel, small-medium scale (up to ~50K DAU)

**Time to migrate:** 1-2 hours

### Steps

**1. Install Amplify CLI**
```bash
npm install -g @aws-amplify/cli
amplify configure
```

**2. Connect your repo**
- Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
- Click "New app" > "Host web app"
- Connect your GitHub repo
- Select the `ments_web_app` directory as the app root

**3. Build settings** — Create `amplify.yml` in project root:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**4. Environment variables**
In Amplify Console > App settings > Environment variables:
```
NEXT_PUBLIC_SUPABASE_URL = your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
GROQ_API_KEY = your-groq-key
```

**5. Deploy**
Push to GitHub — Amplify auto-deploys.

**Pros:**
- Easiest migration from Vercel
- Automatic CI/CD from GitHub
- Built-in CDN (CloudFront)
- SSR support for Next.js
- No function timeout issues (up to 30s default, configurable)

**Cons:**
- Still serverless (cold starts)
- Limited background job support
- Less control than ECS

---

## Option 2: AWS ECS Fargate (Recommended for Full Scale)

**Best for:** Production scale, 50K+ DAU, full control, no timeouts

**Time to migrate:** 4-8 hours

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

# Set build-time env vars (public ones only)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

Update `next.config.ts` to enable standalone output:
```typescript
const nextConfig = {
  output: 'standalone',
  // ... your existing config
};
```

### Step 2: Push to Amazon ECR (Container Registry)

```bash
# Create ECR repository
aws ecr create-repository --repository-name ments-web --region ap-south-1

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com

# Build and push
docker build -t ments-web \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your-url \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  .

docker tag ments-web:latest YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest
```

### Step 3: Create ECS Cluster & Service

**Using AWS Console:**

1. Go to **ECS Console** > Create Cluster
   - Name: `ments-production`
   - Infrastructure: **AWS Fargate**
   - Region: `ap-south-1` (Mumbai)

2. Create **Task Definition**:
   - Family: `ments-web`
   - CPU: 1 vCPU, Memory: 2 GB (start here, scale up as needed)
   - Container:
     - Image: `YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/ments-web:latest`
     - Port: 3000
     - Environment variables:
       ```
       SUPABASE_SERVICE_ROLE_KEY = your-key
       GROQ_API_KEY = your-key
       NEXT_PUBLIC_SUPABASE_URL = your-url
       NEXT_PUBLIC_SUPABASE_ANON_KEY = your-key
       ```

3. Create **Service**:
   - Launch type: Fargate
   - Desired tasks: 2 (minimum for high availability)
   - Load balancer: Create new ALB
   - Health check path: `/api/health` (we'll create this)
   - Auto-scaling: Min 2, Max 10, Target CPU 70%

**Using AWS CLI / Terraform (recommended for repeatability):**

```bash
# Create cluster
aws ecs create-cluster --cluster-name ments-production --region ap-south-1

# Register task definition (save as task-definition.json)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster ments-production \
  --service-name ments-web \
  --task-definition ments-web \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Step 4: Application Load Balancer + CloudFront

```
User → CloudFront (CDN, edge cache) → ALB → ECS Containers
```

1. **ALB** — Created automatically with ECS service
   - Health check: `GET /api/health` returns 200
   - Target group: ECS tasks on port 3000

2. **CloudFront** — Create distribution
   - Origin: ALB DNS name
   - Cache behavior:
     - `/_next/static/*` → Cache 1 year (immutable assets)
     - `/api/*` → No cache (dynamic API routes)
     - Default → Cache 1 hour (SSR pages)
   - Custom domain: `ments.app` (or your domain)
   - SSL: ACM certificate (free)

### Step 5: Create Health Check Endpoint

Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### Step 6: Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/ments-production/ments-web \
  --min-capacity 2 \
  --max-capacity 10

# Scale on CPU utilization
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/ments-production/ments-web \
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

---

## Option 3: AWS EC2 (Most Control, Cheapest at Scale)

**Best for:** Maximum control, budget optimization, 100K+ DAU

**Time to migrate:** 2-4 hours

### Steps

**1. Launch EC2 Instance**
- AMI: Ubuntu 24.04 LTS
- Instance type: `t3.medium` (2 vCPU, 4 GB) to start
- Region: `ap-south-1` (Mumbai)
- Storage: 30 GB gp3
- Security group: Allow ports 80, 443, 22

**2. Install dependencies**
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt-get install -y nginx

# Install Certbot (SSL)
sudo apt-get install -y certbot python3-certbot-nginx
```

**3. Deploy the app**
```bash
# Clone repo
git clone https://github.com/your-username/mentsweb.git
cd mentsweb/ments_web_app

# Install dependencies
npm ci

# Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-key
EOF

# Build
npm run build

# Start with PM2
pm2 start npm --name "ments-web" -- start
pm2 save
pm2 startup  # auto-start on reboot
```

**4. Configure Nginx**
```nginx
# /etc/nginx/sites-available/ments
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;  # No 10s timeout!
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ments /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**5. Auto-deploy on git push** (optional)
```bash
# On EC2, create deploy script
cat > ~/deploy.sh << 'EOF'
#!/bin/bash
cd ~/mentsweb/ments_web_app
git pull origin main
npm ci
npm run build
pm2 restart ments-web
EOF
chmod +x ~/deploy.sh
```

Set up a GitHub webhook or use GitHub Actions to SSH and run `deploy.sh` on push.

---

## Adding Redis (ElastiCache) — Replace Supabase Feed Cache

For production scale, replace the `feed_cache` Supabase table with Redis for sub-millisecond caching.

### Setup

1. **Create ElastiCache Redis cluster**
   - Engine: Redis 7.x
   - Node type: `cache.t3.micro` (free tier) or `cache.r6g.large` (production)
   - Region: same as your ECS/EC2

2. **Install Redis client**
   ```bash
   npm install ioredis
   ```

3. **Create Redis client** (`src/lib/redis.ts`)
   ```typescript
   import Redis from 'ioredis';

   const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
   export default redis;
   ```

4. **Replace cache-manager.ts**
   ```typescript
   import redis from '@/lib/redis';

   export async function getCachedFeed(userId: string, cursor?: string) {
     const cached = await redis.get(`feed:${userId}`);
     if (!cached) return null;

     const entry = JSON.parse(cached);
     // ... pagination logic (same as before)
   }

   export async function writeFeedCache(userId: string, scoredPosts: ScoredPost[]) {
     const data = JSON.stringify({
       post_ids: scoredPosts.map(s => s.post_id),
       scores: scoredPosts.map(s => s.score),
       computed_at: new Date().toISOString(),
     });

     // Set with 2-hour TTL
     await redis.set(`feed:${userId}`, data, 'EX', 7200);
   }

   export async function invalidateFeedCache(userId: string) {
     await redis.del(`feed:${userId}`);
   }
   ```

### Benefits
- **Sub-millisecond reads** (vs 50-100ms Supabase query)
- **No database load** for cache reads
- **Automatic expiry** (Redis TTL vs manual cleanup)
- **Scalable** (Redis cluster for millions of users)

---

## Adding SQS Worker — Background Event Processing

Move event processing out of the API request path for faster responses.

### Architecture
```
Client → /api/feed/events → SQS Queue → Worker → Database
                (fast, just enqueue)         (batch process)
```

### Setup

1. **Create SQS Queue**
   ```bash
   aws sqs create-queue --queue-name ments-feed-events --region ap-south-1
   ```

2. **Install AWS SDK**
   ```bash
   npm install @aws-sdk/client-sqs
   ```

3. **Modify events route** — enqueue instead of direct insert
   ```typescript
   import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

   const sqs = new SQSClient({ region: 'ap-south-1' });

   export async function POST(request: Request) {
     const body = await request.json();

     // Enqueue — returns instantly
     await sqs.send(new SendMessageCommand({
       QueueUrl: process.env.SQS_QUEUE_URL,
       MessageBody: JSON.stringify(body),
     }));

     return NextResponse.json({ ok: true });
   }
   ```

4. **Create worker** (`scripts/event-worker.ts`)
   Run as a separate ECS task or EC2 process:
   ```typescript
   // Polls SQS, batch inserts to database
   // Run: npx tsx scripts/event-worker.ts
   ```

---

## Adding Background Jobs — Cron Scheduling

For periodic tasks like interest profile recomputation, post feature updates, and analytics aggregation.

### Option A: ECS Scheduled Tasks (recommended)
```bash
# Run interest profile recomputation every hour
aws events put-rule \
  --name ments-recompute-profiles \
  --schedule-expression "rate(1 hour)" \
  --region ap-south-1

# Attach ECS task target
aws events put-targets \
  --rule ments-recompute-profiles \
  --targets '[{
    "Id": "recompute-profiles",
    "Arn": "arn:aws:ecs:ap-south-1:ACCOUNT:cluster/ments-production",
    "EcsParameters": {
      "TaskDefinitionArn": "arn:aws:ecs:ap-south-1:ACCOUNT:task-definition/ments-worker",
      "TaskCount": 1,
      "LaunchType": "FARGATE"
    }
  }]'
```

### Option B: node-cron in the worker process
```typescript
import cron from 'node-cron';

// Every hour: recompute interest profiles
cron.schedule('0 * * * *', async () => {
  await recomputeStaleProfiles();
});

// Every 6 hours: recompute post features
cron.schedule('0 */6 * * *', async () => {
  await recomputePostFeatures();
});

// Daily at 2am: aggregate analytics
cron.schedule('0 2 * * *', async () => {
  await aggregateDailyAnalytics();
});
```

---

## CI/CD Pipeline with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
    paths:
      - 'ments_web_app/**'

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: ments-web
  ECS_CLUSTER: ments-production
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
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        working-directory: ments_web_app
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }} \
            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }} \
            -t ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }} \
            -t ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest \
            .
          docker push ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }} --all-tags

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service ${{ env.ECS_SERVICE }} \
            --force-new-deployment
```

---

## Cost Comparison

### Vercel (Current)
| Component | Cost/month |
|-----------|-----------|
| Vercel Pro | $20/member |
| Function executions | $0 (included in Pro) |
| Bandwidth (100GB) | $0 (included) |
| **Total** | **~$20-40/month** |

### AWS Amplify (Option 1)
| Component | Cost/month |
|-----------|-----------|
| Build minutes | ~$2 |
| SSR requests (1M) | ~$5 |
| Bandwidth (100GB) | ~$9 |
| **Total** | **~$15-20/month** |

### AWS ECS Fargate (Option 2)
| Component | Cost/month |
|-----------|-----------|
| 2x Fargate tasks (1vCPU, 2GB) | ~$60 |
| ALB | ~$20 |
| CloudFront (100GB) | ~$9 |
| ElastiCache Redis (t3.micro) | ~$15 |
| ECR storage | ~$1 |
| **Total** | **~$105/month** |
| **At 100K DAU** | **~$200/month** (auto-scaled) |

### AWS EC2 (Option 3)
| Component | Cost/month |
|-----------|-----------|
| t3.medium (reserved 1yr) | ~$18 |
| Elastic IP | $0 (attached) |
| 30GB EBS | ~$3 |
| CloudFront (100GB) | ~$9 |
| **Total** | **~$30/month** |
| **At 100K DAU** (c5.xlarge) | **~$80/month** |

---

## Recommended Path

| Stage | Setup | When |
|-------|-------|------|
| **Now (0-10K DAU)** | AWS Amplify | Quickest fix for Vercel timeout issues |
| **Growth (10K-100K DAU)** | AWS ECS Fargate + Redis | When you need auto-scaling and background jobs |
| **Scale (100K+ DAU)** | ECS + Redis + SQS + RDS | Full microservices architecture |

### Quick Start — AWS Amplify (Do This Now)

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" > "Host web app" > Connect GitHub
3. Select your repo and `ments_web_app` directory
4. Add environment variables (same 4 as Vercel)
5. Deploy — takes ~3 minutes
6. Get your Amplify URL, test the feed

This solves the Vercel timeout issue immediately while you plan the full ECS migration.

---

## Migration Checklist

- [ ] Choose hosting option (Amplify / ECS / EC2)
- [ ] Set up AWS account and IAM user
- [ ] Configure environment variables on AWS
- [ ] Verify Supabase is accessible from AWS region
- [ ] Run both SQL migrations on production Supabase
- [ ] Deploy and verify `/api/health` returns 200
- [ ] Verify `/api/feed` returns `source: "pipeline"`
- [ ] Set up custom domain + SSL
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Set up monitoring (CloudWatch alarms)
- [ ] Set up Redis cache (optional, for scale)
- [ ] Set up SQS event worker (optional, for scale)
- [ ] Load test with k6 or Artillery
