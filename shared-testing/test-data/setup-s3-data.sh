#!/bin/bash
set -e

# Configuration
BUCKET=${BUCKET:-"s3proxy-public"}
REGION=${AWS_REGION:-"us-east-1"}

echo "Setting up test data for s3proxy load testing..."
echo "Bucket: $BUCKET"
echo "Region: $REGION"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed or not in PATH"
    exit 1
fi

# Check if bucket exists and is accessible
echo "Checking bucket access..."
if ! aws s3 ls "s3://$BUCKET" --region "$REGION" > /dev/null 2>&1; then
    echo "Error: Cannot access bucket s3://$BUCKET"
    echo "Please ensure:"
    echo "1. The bucket exists"
    echo "2. You have proper AWS credentials configured"
    echo "3. You have read/write permissions to the bucket"
    exit 1
fi

# Create temporary directory for test files
TEMP_DIR=$(mktemp -d)
echo "Creating test files in: $TEMP_DIR"

# Create index.html (338 bytes)
cat > "$TEMP_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>S3Proxy Test</title>
</head>
<body>
    <h1>S3Proxy Load Test File</h1>
    <p>This is a test file for s3proxy load testing.</p>
    <p>File size: 338 bytes</p>
    <p>Used for basic HTML serving tests.</p>
</body>
</html>
EOF

# Create large.bin (10MB)
echo "Creating large.bin (10MB)..."
dd if=/dev/zero of="$TEMP_DIR/large.bin" bs=1024 count=10240 2>/dev/null

# Create test1m.tmp (1MB)
echo "Creating test1m.tmp (1MB)..."
dd if=/dev/zero of="$TEMP_DIR/test1m.tmp" bs=1024 count=1024 2>/dev/null

# Create zero byte file
touch "$TEMP_DIR/zerobytefile"

# Create unauthorized.html (will be made inaccessible)
cat > "$TEMP_DIR/unauthorized.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Unauthorized</title>
</head>
<body>
    <h1>This file should return 403</h1>
</body>
</html>
EOF

# Create special characters file
SPECIAL_CHARS_FILE="specialCharacters!-_.*'()&\$@=;:+  ,?\\{^}%\`]\">[~<#|."
echo "Test file with special characters in filename" > "$TEMP_DIR/$SPECIAL_CHARS_FILE"

echo "Uploading files to S3..."

# Upload files
aws s3 cp "$TEMP_DIR/index.html" "s3://$BUCKET/index.html" --region "$REGION" --no-progress
echo "✓ Uploaded index.html"

aws s3 cp "$TEMP_DIR/large.bin" "s3://$BUCKET/large.bin" --region "$REGION" --no-progress
echo "✓ Uploaded large.bin"

aws s3 cp "$TEMP_DIR/test1m.tmp" "s3://$BUCKET/test1m.tmp" --region "$REGION" --no-progress
echo "✓ Uploaded test1m.tmp"

aws s3 cp "$TEMP_DIR/zerobytefile" "s3://$BUCKET/zerobytefile" --region "$REGION" --no-progress
echo "✓ Uploaded zerobytefile"

aws s3 cp "$TEMP_DIR/unauthorized.html" "s3://$BUCKET/unauthorized.html" --region "$REGION" --no-progress
echo "✓ Uploaded unauthorized.html"

aws s3 cp "$TEMP_DIR/$SPECIAL_CHARS_FILE" "s3://$BUCKET/$SPECIAL_CHARS_FILE" --region "$REGION" --no-progress
echo "✓ Uploaded special characters file"

# Set restricted permissions on unauthorized.html (this may not work on all S3 configurations)
echo "Setting restricted permissions on unauthorized.html..."
aws s3api put-object-acl --bucket "$BUCKET" --key "unauthorized.html" --acl private --region "$REGION" 2>/dev/null || echo "⚠️  Could not set private ACL - file may not return 403"

# Clean up temporary files
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Test data setup complete!"
echo ""
echo "Files created in s3://$BUCKET/:"
echo "  - index.html (338 bytes)"
echo "  - large.bin (10MB)"
echo "  - test1m.tmp (1MB)"
echo "  - zerobytefile (0 bytes)"
echo "  - unauthorized.html (should return 403)"
echo "  - $SPECIAL_CHARS_FILE (special characters test)"
echo ""
echo "You can now run load tests against your s3proxy instance."
