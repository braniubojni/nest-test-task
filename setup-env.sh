echo "Creating environment files..."

# Service A Development
cat > service-a/.env.development << 'EOF'
PORT=3000
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
MONGO_DATABASE=serviceA
REDIS_HOST=localhost
REDIS_PORT=6379
EXTERNAL_API_URL="https://dummyjson.com/products"
EOF

# Service A Production
cat > service-a/.env.production << 'EOF'
PORT=3000
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
MONGO_DATABASE=serviceA
REDIS_HOST=localhost
REDIS_PORT=6379
EXTERNAL_API_URL="https://dummyjson.com/products"
EOF

# Service B Development
cat > service-b/.env.development << 'EOF'
PORT=3001
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
REDIS_HOST=localhost
REDIS_PORT=6379
MONGO_DATABASE=serviceB
EOF

# Service B Production
cat > service-b/.env.production << 'EOF'
PORT=3001
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=mongodb
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
REDIS_HOST=redis
REDIS_PORT=6379
MONGO_DATABASE=serviceB
EOF

echo "✅ Environment files created!"
echo ""
echo "Files created:"
echo "  - service-a/.env.development"
echo "  - service-a/.env.production"
echo "  - service-b/.env.development"
echo "  - service-b/.env.production"
