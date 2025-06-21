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
<!doctype html>

<html lang="en">
<head>
  <meta charset="utf-8">

  <title>s3proxy</title>
  <meta name="description" content="s3proxy landing page">
  <meta name="author" content="George Moon">
</head>

<body>
<h1>s3proxy public landing page</h1>
The public repo is <a href="https://github.com/gmoon/s3proxy">here</a>.
</body>
</html>

EOF

# Create large.bin (10MB) with varied binary content
echo "Creating large.bin (10MB) with random binary data..."
if command -v openssl &> /dev/null; then
    # Use OpenSSL for cross-platform random data generation
    openssl rand -out "$TEMP_DIR/large.bin" 10485760
elif [[ -r /dev/urandom ]]; then
    # Use /dev/urandom on Unix systems
    dd if=/dev/urandom of="$TEMP_DIR/large.bin" bs=1024 count=10240 2>/dev/null
else
    # Fallback: create a pattern-based file with varied content
    echo "Warning: No random source available, creating pattern-based binary file"
    python3 -c "
import os
with open('$TEMP_DIR/large.bin', 'wb') as f:
    for i in range(10485760):
        f.write(bytes([i % 256]))
"
fi

# Create test1m.tmp (1MB) with varied binary content
echo "Creating test1m.tmp (1MB) with random binary data..."
if command -v openssl &> /dev/null; then
    openssl rand -out "$TEMP_DIR/test1m.tmp" 1048576
elif [[ -r /dev/urandom ]]; then
    dd if=/dev/urandom of="$TEMP_DIR/test1m.tmp" bs=1024 count=1024 2>/dev/null
else
    # Fallback: create a different pattern for variety
    python3 -c "
import os
with open('$TEMP_DIR/test1m.tmp', 'wb') as f:
    for i in range(1048576):
        f.write(bytes([(i * 7) % 256]))
"
fi

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

# Calculate and display file hashes for validation
echo ""
echo "File integrity information:"
if command -v md5sum &> /dev/null; then
    echo "large.bin MD5: $(md5sum "$TEMP_DIR/large.bin" | cut -d' ' -f1)"
    echo "test1m.tmp MD5: $(md5sum "$TEMP_DIR/test1m.tmp" | cut -d' ' -f1)"
elif command -v md5 &> /dev/null; then
    echo "large.bin MD5: $(md5 -q "$TEMP_DIR/large.bin")"
    echo "test1m.tmp MD5: $(md5 -q "$TEMP_DIR/test1m.tmp")"
fi

# Verify files contain non-zero bytes
echo ""
echo "Verifying binary file integrity..."
if command -v hexdump &> /dev/null; then
    echo "large.bin first 32 bytes:"
    hexdump -C "$TEMP_DIR/large.bin" | head -2
    echo "test1m.tmp first 32 bytes:"
    hexdump -C "$TEMP_DIR/test1m.tmp" | head -2
fi

echo ""
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

# Verify uploads by checking file sizes
echo ""
echo "Verifying uploads..."
aws s3 ls "s3://$BUCKET/" --region "$REGION" --human-readable --summarize

# Clean up temporary files
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Test data setup complete!"
echo ""
echo "Files created in s3://$BUCKET/:"
echo "  - index.html (338 bytes) - HTML test file"
echo "  - large.bin (10MB) - Large binary file with random data"
echo "  - test1m.tmp (1MB) - Medium binary file with random data"
echo "  - zerobytefile (0 bytes) - Empty file test"
echo "  - unauthorized.html - Access control test (may return 403)"
echo "  - $SPECIAL_CHARS_FILE - Special characters filename test"
echo ""
echo "Binary files now contain varied random data for proper integrity testing."
echo "You can now run load tests and validation tests against your s3proxy instance."
