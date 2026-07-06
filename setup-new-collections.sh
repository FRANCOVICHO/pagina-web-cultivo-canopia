#!/bin/bash
# Script para crear las nuevas colecciones en PocketBase

PB_URL="http://localhost:8090"
ADMIN_EMAIL="francolinaresgonzalez11@gmail.com"
ADMIN_PASS="Messifranco2009"

echo "==> Obteniendo token de admin..."
TOKEN=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: No se pudo obtener el token."
  exit 1
fi
echo "==> Token OK"

create_col() {
  local NAME=$1
  local FILE=$2
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d @"$FILE")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)
  echo "==> $NAME: HTTP $HTTP_CODE"
  if [ "$HTTP_CODE" != "200" ]; then
    echo "    Error: $BODY"
  fi
}

# Obtener ID de la colección plants
PLANTS_ID=$(curl -s "$PB_URL/api/collections/plants" \
  -H "Authorization: $TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "==> plants ID: $PLANTS_ID"

# ── photos ──
cat > /tmp/col_photos.json << EOF
{
  "name": "photos",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {"name":"plant","type":"relation","required":true,"options":{"collectionId":"$PLANTS_ID","cascadeDelete":true,"maxSelect":1}},
    {"name":"image","type":"file","required":true,"options":{"maxSelect":1,"maxSize":10485760,"mimeTypes":["image/jpeg","image/png","image/webp"]}},
    {"name":"capture_date","type":"text","required":false,"options":{}},
    {"name":"notes","type":"text","required":false,"options":{}},
    {"name":"user","type":"relation","required":true,"options":{"collectionId":"_pb_users_auth_","cascadeDelete":true,"maxSelect":1}}
  ]
}
EOF
create_col "photos" /tmp/col_photos.json

# ── activities ──
cat > /tmp/col_activities.json << EOF
{
  "name": "activities",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {"name":"plant","type":"relation","required":true,"options":{"collectionId":"$PLANTS_ID","cascadeDelete":true,"maxSelect":1}},
    {"name":"activity_type","type":"text","required":true,"options":{}},
    {"name":"activity_date","type":"text","required":true,"options":{}},
    {"name":"notes","type":"text","required":false,"options":{}},
    {"name":"user","type":"relation","required":true,"options":{"collectionId":"_pb_users_auth_","cascadeDelete":true,"maxSelect":1}},
    {"name":"is_custom","type":"bool","required":false,"options":{}}
  ]
}
EOF
create_col "activities" /tmp/col_activities.json

# ── tasks ──
cat > /tmp/col_tasks.json << EOF
{
  "name": "tasks",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {"name":"plant","type":"relation","required":true,"options":{"collectionId":"$PLANTS_ID","cascadeDelete":true,"maxSelect":1}},
    {"name":"activity_type","type":"text","required":true,"options":{}},
    {"name":"scheduled_date","type":"text","required":true,"options":{}},
    {"name":"completed","type":"bool","required":false,"options":{}},
    {"name":"completed_date","type":"text","required":false,"options":{}},
    {"name":"user","type":"relation","required":true,"options":{"collectionId":"_pb_users_auth_","cascadeDelete":true,"maxSelect":1}},
    {"name":"auto_generated","type":"bool","required":false,"options":{}}
  ]
}
EOF
create_col "tasks" /tmp/col_tasks.json

# ── harvests ──
cat > /tmp/col_harvests.json << EOF
{
  "name": "harvests",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {"name":"plant","type":"relation","required":true,"options":{"collectionId":"$PLANTS_ID","cascadeDelete":true,"maxSelect":1}},
    {"name":"harvest_date","type":"text","required":true,"options":{}},
    {"name":"weight_grams","type":"number","required":false,"options":{}},
    {"name":"notes","type":"text","required":false,"options":{}},
    {"name":"user","type":"relation","required":true,"options":{"collectionId":"_pb_users_auth_","cascadeDelete":true,"maxSelect":1}}
  ]
}
EOF
create_col "harvests" /tmp/col_harvests.json

echo ""
echo "==> Listo!"
