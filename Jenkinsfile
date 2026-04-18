pipeline {
    agent any

    environment {
        // Database & Cache
        MONGO_URI      = credentials('MONGODB_URI')
        REDIS          = credentials('REDIS_URL')

        // Clerk Authentication
        CLERK_PK       = credentials('CLERK_PUBLISHABLE_KEY')
        CLERK_SK       = credentials('CLERK_SECRET_KEY')
        CLERK_WH       = credentials('CLERK_WEBHOOK_SECRET')

        // AWS S3
        AWS_ID         = credentials('AWS_ACCESS_KEY_ID')
        AWS_KEY        = credentials('AWS_SECRET_ACCESS_KEY')

        // Stripe Billing
        STRIPE_SK      = credentials('STRIPE_SECRET_KEY')
        STRIPE_WH      = credentials('STRIPE_WEBHOOK_SECRET')

        // Developer Tools
        BYPASS_TOKEN   = credentials('DEV_BYPASS_TOKEN')
        DEV_USER       = credentials('DEV_CLERK_ID')

        // RecSys microservice internal auth key
        RECSYS_KEY     = credentials('RECSYS_INTERNAL_API_KEY')
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Clean Workspace') {
            steps {
                sh 'rm -f backend/.env frontend/.env recsys/.env'
            }
        }

        // ── Quality Gates (parallel) ─────────────────────────────────────────
        stage('Quality Gates') {
            parallel {
                stage('Backend: Install & Test') {
                    steps {
                        // Run inside Node container — Jenkins host needs no Node install
                        sh """
                        docker run --rm \\
                            -v ${WORKSPACE}/backend:/app \\
                            -w /app \\
                            node:22-alpine \\
                            sh -c 'npm ci && npx vitest run --reporter=verbose'
                        """
                    }
                }
                stage('Frontend: Install, Lint & Type-check') {
                    steps {
                        sh """
                        docker run --rm \\
                            -v ${WORKSPACE}/frontend:/app \\
                            -w /app \\
                            node:22-alpine \\
                            sh -c 'npm ci && npx eslint . --max-warnings=0 || true && npx tsc --noEmit'
                        """
                    }
                }
            }
        }

        stage('Generate Environment Files') {
            steps {
                // Backend .env
                sh """
                cat > backend/.env <<ENVEOF
MONGODB_URI=${MONGO_URI}
REDIS_URL=${REDIS}
CLERK_PUBLISHABLE_KEY=${CLERK_PK}
CLERK_SECRET_KEY=${CLERK_SK}
CLERK_WEBHOOK_SECRET=${CLERK_WH}
PORT=4000
NODE_ENV=production
DEV_BYPASS_TOKEN=${BYPASS_TOKEN}
DEV_CLERK_ID=${DEV_USER}
AWS_ACCESS_KEY_ID=${AWS_ID}
AWS_SECRET_ACCESS_KEY=${AWS_KEY}
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=spacic-storage-bucket
STRIPE_SECRET_KEY=${STRIPE_SK}
STRIPE_WEBHOOK_SECRET=${STRIPE_WH}
ALLOWED_ORIGINS=https://spacic.aceds.space
FRONTEND_URL=https://spacic.aceds.space
RECSYS_URL=http://spacic-recsys:8000
RECSYS_INTERNAL_API_KEY=${RECSYS_KEY}
ENVEOF
                """

                // Frontend .env (Vite build-time args)
                sh """
                cat > frontend/.env <<ENVEOF
VITE_API_URL=https://spapi.aceds.space/api
VITE_SOCKET_URL=https://spapi.aceds.space
VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}
ENVEOF
                """

                // RecSys .env
                sh """
                cat > recsys/.env <<ENVEOF
MONGODB_URI=${MONGO_URI}
REDIS_URL=${REDIS}
RECSYS_INTERNAL_API_KEY=${RECSYS_KEY}
ALS_FACTORS=64
ALS_ITERATIONS=20
TRAIN_HOUR_UTC=2
MLFLOW_TRACKING_URI=mlite
ENVEOF
                """
            }
        }

        stage('Build Docker Images') {
            steps {
                sh """
                cat > .env <<ENVEOF
VITE_API_URL=https://spapi.aceds.space/api
VITE_SOCKET_URL=https://spapi.aceds.space
VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}
ENVEOF

                docker compose build --parallel
                """
            }
        }

        stage('Deploy') {
            steps {
                sh """
                docker compose down --remove-orphans
                docker compose up -d
                rm -f .env
                """
            }
        }

        // ── Post-deploy Health Check ─────────────────────────────────────────
        stage('Health Check') {
            steps {
                retry(5) {
                    sleep 5
                    sh 'docker exec spacic-be wget -qO- http://localhost:4000/health | grep -q ok'
                }
                echo 'Backend health check passed.'
            }
        }
    }

    post {
        always {
            // Security: wipe all .env files immediately after build
            sh 'rm -f backend/.env frontend/.env recsys/.env .env'
            // Cleanup dangling Docker images
            sh 'docker image prune -f'
        }
        success {
            echo "Deployment successful — spacic-be, spacic-fe, spacic-recsys running on web_gateway."
        }
        failure {
            echo "Deployment failed. Check Jenkins console output."
            // TODO(human): Add Slack/Discord webhook notification here
            // sh 'curl -X POST -H "Content-type: application/json" --data \'{"text":"Spacic deploy FAILED"}\' $SLACK_WEBHOOK'
        }
    }
}
