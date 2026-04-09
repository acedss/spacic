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
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Pulls the latest code from your GitHub repository
                checkout scm
            }
        }

        stage('Clean Workspace') {
            steps {
                // Ensure no leftover .env files exist from failed builds
                sh 'rm -f backend/.env'
                sh 'rm -f frontend/.env'
            }
        }

        stage('Generate Environment Files') {
            steps {
                // Injecting variables into the Backend .env
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
                """

                // Injecting variables into the Frontend .env (For Vite build process)
                sh """
                echo "VITE_API_URL=https://spapi.aceds.space" > frontend/.env
                echo "VITE_SOCKET_URL=https://spapi.aceds.space" >> frontend/.env
                echo "VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PK}" >> frontend/.env
                """
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                // Build the new images and recreate containers seamlessly
                sh 'docker compose up --build -d'
            }
        }
    }

    post {
        always {
            // Security: Wipe the .env files from the disk immediately after the build finishes
            sh 'rm -f backend/.env'
            sh 'rm -f frontend/.env'
            
            // Optimization: Clean up old, unused Docker images to save disk space
            sh 'docker image prune -f'
        }
        success {
            echo "✅ Deployment successful! Your app is running on the web_gateway network."
        }
        failure {
            echo "❌ Deployment failed. Please check the Jenkins console output."
        }
    }
}