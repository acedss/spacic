pipeline {
    agent any

    // 1. Securely bind Jenkins Credentials to Pipeline Variables
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
        // Add this in Jenkins: Manage Jenkins → Credentials → New Secret Text → ID: RECSYS_INTERNAL_API_KEY
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
                sh 'rm -f backend/.env'
                sh 'rm -f frontend/.env'
                sh 'rm -f recsys/.env'
            }
        }

        stage('Generate Environment Files') {
            steps {
                // Backend .env
                sh """
                echo "MONGODB_URI=${MONGO_URI}" > backend/.env
                echo "REDIS_URL=${REDIS}" >> backend/.env

                echo "CLERK_PUBLISHABLE_KEY=${CLERK_PK}" >> backend/.env
                echo "CLERK_SECRET_KEY=${CLERK_SK}" >> backend/.env
                echo "CLERK_WEBHOOK_SECRET=${CLERK_WH}" >> backend/.env

                echo "PORT=4000" >> backend/.env
                echo "NODE_ENV=production" >> backend/.env

                echo "DEV_BYPASS_TOKEN=${BYPASS_TOKEN}" >> backend/.env
                echo "DEV_CLERK_ID=${DEV_USER}" >> backend/.env

                echo "AWS_ACCESS_KEY_ID=${AWS_ID}" >> backend/.env
                echo "AWS_SECRET_ACCESS_KEY=${AWS_KEY}" >> backend/.env
                echo "AWS_REGION=ap-southeast-1" >> backend/.env
                echo "S3_BUCKET_NAME=spacic-storage-bucket" >> backend/.env

                echo "STRIPE_SECRET_KEY=${STRIPE_SK}" >> backend/.env
                echo "STRIPE_WEBHOOK_SECRET=${STRIPE_WH}" >> backend/.env

                echo "ALLOWED_ORIGINS=https://spacic.aceds.space" >> backend/.env
                echo "FRONTEND_URL=https://spacic.aceds.space" >> backend/.env

                # RecSys: container name resolves on the web_gateway Docker network
                echo "RECSYS_URL=http://spacic-recsys:8000" >> backend/.env
                echo "RECSYS_INTERNAL_API_KEY=${RECSYS_KEY}" >> backend/.env
                """

                // Frontend .env (Vite build-time args)
                sh """
                echo "VITE_API_URL=https://spapi.aceds.space/api" > frontend/.env
                echo "VITE_SOCKET_URL=https://spapi.aceds.space" >> frontend/.env
                echo "VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}" >> frontend/.env
                """

                // RecSys .env — reuses same Mongo + Redis as backend
                sh """
                echo "MONGODB_URI=${MONGO_URI}" > recsys/.env
                echo "REDIS_URL=${REDIS}" >> recsys/.env
                echo "RECSYS_INTERNAL_API_KEY=${RECSYS_KEY}" >> recsys/.env
                echo "ALS_FACTORS=64" >> recsys/.env
                echo "ALS_ITERATIONS=20" >> recsys/.env
                echo "TRAIN_HOUR_UTC=2" >> recsys/.env
                echo "MLFLOW_TRACKING_URI=mlite" >> recsys/.env
                """
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh """
                # Root .env for docker compose build-arg substitution (frontend only)
                echo "VITE_API_URL=https://spapi.aceds.space/api" > .env
                echo "VITE_SOCKET_URL=https://spapi.aceds.space" >> .env
                echo "VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}" >> .env

                # Shut down existing containers and clear orphans
                docker compose down --remove-orphans

                # Build and launch all three services
                docker compose up --build -d

                # Cleanup temp root .env
                rm .env
                """
            }
        }
    }

    post {
        always {
            // Security: wipe all .env files immediately after build
            sh 'rm -f backend/.env'
            sh 'rm -f frontend/.env'
            sh 'rm -f recsys/.env'

            // Optimization: clean dangling Docker images
            sh 'docker image prune -f'
        }
        success {
            echo "Deployment successful — spacic-be, spacic-fe, spacic-recsys running on web_gateway."
        }
        failure {
            echo "Deployment failed. Check Jenkins console output."
        }
    }
}
