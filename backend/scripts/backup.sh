#!/bin/bash
# scripts/backup.sh
# Simple MongoDB backup script

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="aura_market"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "📦 Starting database backup for $DB_NAME..."

# Run mongodump (Assumes mongodump is installed and MONGODB_URI is set)
if [ -z "$MONGODB_URI" ]; then
  echo "❌ Error: MONGODB_URI is not set."
  exit 1
fi

mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$TIMESTAMP"

if [ $? -eq 0 ]; then
  echo "✅ Backup completed successfully: $BACKUP_DIR/$TIMESTAMP"
  # Optional: Compress the backup
  tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" "$BACKUP_DIR/$TIMESTAMP"
  rm -rf "$BACKUP_DIR/$TIMESTAMP"
  echo "📦 Compressed backup: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
else
  echo "❌ Backup failed."
  exit 1
fi
