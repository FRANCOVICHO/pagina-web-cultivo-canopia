#!/bin/bash
# Script para configurar las colecciones en PocketBase
# Correr desde el servidor Linux

PB_URL="http://localhost:8090"
ADMIN_EMAIL="francolinaresgonzalez11@gmail.com"
ADMIN_PASS="Messifranco2009"

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

echo "==> Creando colección 'plants'..."
curl -s -X POST "$PB_URL/api/collections" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d '{
    "name": "plants",
    "type": "base",
    "listRule": "@request.auth.id = user",
    "viewRule": "@request.auth.id = user",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id = user",
    "deleteRule": "@request.auth.id = user",
    "schema": [
      {"name":"user","type":"relation","required":true,"options":{"collectionId":"_pb_users_auth_","cascadeDelete":true,"maxSelect":1,"displayFields":["email"]}},
      {"name":"name","type":"text","required":true,"options":{"min":1,"max":100}},
      {"name":"genetics","type":"text","required":true,"options":{"min":1,"max":100}},
      {"name":"type","type":"select","required":true,"options":{"maxSelect":1,"values":["autoflowering","photoperiod"]}},
      {"name":"environment","type":"select","required":false,"options":{"maxSelect":1,"values":["Interior","Exterior"]}},
      {"name":"start_date","type":"text","required":true,"options":{}},
      {"name":"dur_germination","type":"number","required":false,"options":{}},
      {"name":"dur_vegetative","type":"number","required":false,"options":{}},
      {"name":"dur_flowering","type":"number","required":false,"options":{}},
      {"name":"dur_drying","type":"number","required":false,"options":{}}
    ]
  }'

echo ""
echo "==> Colección 'plants' creada OK"
echo ""
echo "==> Listo! Ahora podés crear usuarios desde:"
echo "    $PB_URL/_/"
echo ""
echo "==> Para crear un usuario de cliente, andá a:"
echo "    $PB_URL/_/ -> Collections -> users -> New record"
