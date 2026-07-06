#!/bin/bash
# Script para crear las nuevas colecciones en PocketBase
# Requeridas por las funcionalidades nuevas del Hemp Plant Tracker

PB_URL="http://localhost:8090"
ADMIN_EMAIL="francolinaresgonzalez11@gmail.com"
ADMIN_PASS="Messifranco2009"

# ─── Helper ────────────────────────────────────────────────────────────────────
create_collection() {
  local NAME="$1"
  local PAYLOAD="$2"

  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d "$PAYLOAD")

  if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
    echo "==> Colección '$NAME' OK (HTTP $RESPONSE)"
  else
    echo "==> ERROR creando '$NAME' (HTTP $RESPONSE)"
  fi
}

# ─── Auth ──────────────────────────────────────────────────────────────────────
echo "==> Obteniendo token de admin..."
TOKEN=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: No se pudo obtener el token. Verificá el email y contraseña."
  exit 1
fi
echo "==> Token obtenido OK"
echo ""

# ─── 1. photos ─────────────────────────────────────────────────────────────────
create_collection "photos" '{
  "name": "photos",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {
      "name": "plant",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "plants",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "image",
      "type": "file",
      "required": true,
      "options": {
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": ["image/jpeg","image/png","image/webp"]
      }
    },
    {
      "name": "capture_date",
      "type": "text",
      "required": false,
      "options": {}
    },
    {
      "name": "notes",
      "type": "text",
      "required": false,
      "options": {"max": 500}
    },
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    }
  ]
}'

# ─── 2. activities ─────────────────────────────────────────────────────────────
create_collection "activities" '{
  "name": "activities",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {
      "name": "plant",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "plants",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "activity_type",
      "type": "text",
      "required": true,
      "options": {"max": 100}
    },
    {
      "name": "activity_date",
      "type": "text",
      "required": true,
      "options": {}
    },
    {
      "name": "notes",
      "type": "text",
      "required": false,
      "options": {"max": 500}
    },
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "is_custom",
      "type": "bool",
      "required": false,
      "options": {}
    }
  ]
}'

# ─── 3. custom_activity_types ──────────────────────────────────────────────────
create_collection "custom_activity_types" '{
  "name": "custom_activity_types",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {
      "name": "name",
      "type": "text",
      "required": true,
      "options": {"max": 50}
    },
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    }
  ]
}'

# ─── 4. tasks ──────────────────────────────────────────────────────────────────
create_collection "tasks" '{
  "name": "tasks",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {
      "name": "plant",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "plants",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "activity_type",
      "type": "text",
      "required": true,
      "options": {"max": 100}
    },
    {
      "name": "scheduled_date",
      "type": "text",
      "required": true,
      "options": {}
    },
    {
      "name": "completed",
      "type": "bool",
      "required": false,
      "options": {}
    },
    {
      "name": "completed_date",
      "type": "text",
      "required": false,
      "options": {}
    },
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "auto_generated",
      "type": "bool",
      "required": false,
      "options": {}
    }
  ]
}'

# ─── 5. genetics_db ────────────────────────────────────────────────────────────
create_collection "genetics_db" '{
  "name": "genetics_db",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\"",
  "schema": [
    {
      "name": "name",
      "type": "text",
      "required": true,
      "options": {"max": 100}
    },
    {
      "name": "thc_pct",
      "type": "text",
      "required": false,
      "options": {}
    },
    {
      "name": "cbd_pct",
      "type": "text",
      "required": false,
      "options": {}
    },
    {
      "name": "bank",
      "type": "text",
      "required": false,
      "options": {"max": 100}
    },
    {
      "name": "dominance",
      "type": "select",
      "required": false,
      "options": {
        "maxSelect": 1,
        "values": ["Índica", "Sativa", "Híbrida"]
      }
    },
    {
      "name": "height_cm",
      "type": "text",
      "required": false,
      "options": {}
    },
    {
      "name": "notes",
      "type": "text",
      "required": false,
      "options": {"max": 1000}
    },
    {
      "name": "ai_generated",
      "type": "bool",
      "required": false,
      "options": {}
    }
  ]
}'

# ─── 6. harvests ───────────────────────────────────────────────────────────────
create_collection "harvests" '{
  "name": "harvests",
  "type": "base",
  "listRule": "@request.auth.id = user",
  "viewRule": "@request.auth.id = user",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user",
  "deleteRule": "@request.auth.id = user",
  "schema": [
    {
      "name": "plant",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "plants",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    },
    {
      "name": "harvest_date",
      "type": "text",
      "required": true,
      "options": {}
    },
    {
      "name": "weight_grams",
      "type": "number",
      "required": false,
      "options": {"min": 0}
    },
    {
      "name": "notes",
      "type": "text",
      "required": false,
      "options": {"max": 500}
    },
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": true,
        "maxSelect": 1
      }
    }
  ]
}'

echo ""
echo "==> ¡Listo! Las 6 colecciones nuevas fueron procesadas."
echo "    Revisá el panel admin en: $PB_URL/_/"
