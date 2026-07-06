#!/bin/bash
# seed-genetics.sh
# Pre-carga las 30 variedades más comunes en genetics_db de PocketBase

PB_URL="http://localhost:8090"
ADMIN_EMAIL="francolinaresgonzalez11@gmail.com"
ADMIN_PASS="Messifranco2009"

echo "==> Obteniendo token de admin..."
TOKEN=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then echo "ERROR: Token no obtenido."; exit 1; fi
echo "==> Token OK"

add_strain() {
  curl -s -X POST "$PB_URL/api/collections/genetics_db/records" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d "$1" | grep -o '"name":"[^"]*"' | head -1
}

echo "==> Cargando genéticas..."

add_strain '{"name":"Northern Lights","thc_pct":"16-21%","cbd_pct":"0.1%","bank":"Sensi Seeds","dominance":"Índica","height_cm":"100-160","notes":"Clásica índica, resistente, aroma resinoso dulce.","ai_generated":false}'
add_strain '{"name":"White Widow","thc_pct":"18-25%","cbd_pct":"0.2%","bank":"Dutch Passion","dominance":"Híbrida","height_cm":"100-130","notes":"Híbrida icónica, cobertura de cristales densa.","ai_generated":false}'
add_strain '{"name":"Blue Dream","thc_pct":"17-24%","cbd_pct":"0.1%","bank":"DJ Short","dominance":"Sativa","height_cm":"150-200","notes":"Sativa dominante, sabor frutal a arándanos.","ai_generated":false}'
add_strain '{"name":"OG Kush","thc_pct":"19-26%","cbd_pct":"0.2%","bank":"Unknown","dominance":"Híbrida","height_cm":"90-130","notes":"Perfil terroso y pimentado, muy popular en California.","ai_generated":false}'
add_strain '{"name":"Gorilla Glue #4","thc_pct":"25-30%","cbd_pct":"0.1%","bank":"GG Strains","dominance":"Híbrida","height_cm":"100-150","notes":"Alta producción de resina, efecto potente y relajante.","ai_generated":false}'
add_strain '{"name":"Amnesia Haze","thc_pct":"20-25%","cbd_pct":"0.1%","bank":"Soma Seeds","dominance":"Sativa","height_cm":"130-180","notes":"Sativa cerebral, aroma cítrico y terroso.","ai_generated":false}'
add_strain '{"name":"Critical Kush","thc_pct":"20-25%","cbd_pct":"1-2%","bank":"Barney'\''s Farm","dominance":"Índica","height_cm":"80-120","notes":"Índica CBD elevado, efecto relajante profundo.","ai_generated":false}'
add_strain '{"name":"Green Crack","thc_pct":"15-25%","cbd_pct":"0.1%","bank":"Snoop Dogg","dominance":"Sativa","height_cm":"100-150","notes":"Efecto energético y enfocado, sabor afrutado.","ai_generated":false}'
add_strain '{"name":"Sour Diesel","thc_pct":"20-25%","cbd_pct":"0.2%","bank":"Unknown","dominance":"Sativa","height_cm":"150-200","notes":"Aroma diesel intenso, efecto cerebral duradero.","ai_generated":false}'
add_strain '{"name":"Girl Scout Cookies","thc_pct":"22-28%","cbd_pct":"0.2%","bank":"Cookie Fam","dominance":"Híbrida","height_cm":"100-150","notes":"Dulce y terrosa, efectos eufóricos y relajantes.","ai_generated":false}'
add_strain '{"name":"Jack Herer","thc_pct":"18-24%","cbd_pct":"0.1%","bank":"Sensi Seeds","dominance":"Sativa","height_cm":"130-180","notes":"Sativa clásica, aroma herbal y pino.","ai_generated":false}'
add_strain '{"name":"Trainwreck","thc_pct":"18-25%","cbd_pct":"0.1%","bank":"Unknown","dominance":"Sativa","height_cm":"120-180","notes":"Efecto rápido y cerebral, aroma cítrico-pino.","ai_generated":false}'
add_strain '{"name":"Pineapple Express","thc_pct":"17-25%","cbd_pct":"0.1%","bank":"G13 Labs","dominance":"Híbrida","height_cm":"100-140","notes":"Aroma tropical a piña, efecto equilibrado.","ai_generated":false}'
add_strain '{"name":"Gelato","thc_pct":"20-26%","cbd_pct":"0.2%","bank":"Cookie Fam","dominance":"Híbrida","height_cm":"100-130","notes":"Sabor cremoso a helado, efecto relajante y eufórico.","ai_generated":false}'
add_strain '{"name":"Wedding Cake","thc_pct":"22-27%","cbd_pct":"0.1%","bank":"Seed Junky","dominance":"Híbrida","height_cm":"100-130","notes":"Terpenoide rico, sabor dulce vainilla y tierra.","ai_generated":false}'
add_strain '{"name":"Zkittlez","thc_pct":"19-23%","cbd_pct":"0.2%","bank":"3rd Gen Family","dominance":"Índica","height_cm":"100-120","notes":"Dulce y frutal, relajante y sedante.","ai_generated":false}'
add_strain '{"name":"Purple Punch","thc_pct":"18-22%","cbd_pct":"0.1%","bank":"Supernova Gardens","dominance":"Índica","height_cm":"80-110","notes":"Sabor uva y arándano, efecto sedante nocturno.","ai_generated":false}'
add_strain '{"name":"Runtz","thc_pct":"19-29%","cbd_pct":"0.1%","bank":"Cookies","dominance":"Híbrida","height_cm":"100-140","notes":"Sabor dulce golosina, efectos potentes y prolongados.","ai_generated":false}'
add_strain '{"name":"Mimosa","thc_pct":"19-27%","cbd_pct":"0.1%","bank":"Symbiotic Genetics","dominance":"Sativa","height_cm":"120-160","notes":"Aroma cítrico, efecto energético y social.","ai_generated":false}'
add_strain '{"name":"Do-Si-Dos","thc_pct":"21-30%","cbd_pct":"0.1%","bank":"Archive Seed Bank","dominance":"Índica","height_cm":"80-120","notes":"Efecto relajante intenso, aroma floral terroso.","ai_generated":false}'
add_strain '{"name":"Super Lemon Haze","thc_pct":"16-25%","cbd_pct":"0.1%","bank":"Greenhouse Seeds","dominance":"Sativa","height_cm":"150-200","notes":"Cítrico intenso, efecto energético ganador de premios.","ai_generated":false}'
add_strain '{"name":"Bubba Kush","thc_pct":"14-22%","cbd_pct":"0.1%","bank":"Unknown","dominance":"Índica","height_cm":"80-100","notes":"Aroma café y chocolate, efecto sedante clásico.","ai_generated":false}'
add_strain '{"name":"Cherry Pie","thc_pct":"16-24%","cbd_pct":"0.2%","bank":"Unknown","dominance":"Híbrida","height_cm":"100-150","notes":"Dulce y ácido como cereza, efecto equilibrado.","ai_generated":false}'
add_strain '{"name":"Durban Poison","thc_pct":"15-25%","cbd_pct":"0.1%","bank":"Unknown","dominance":"Sativa","height_cm":"150-200","notes":"Sativa africana pura, aroma anís y menta.","ai_generated":false}'
add_strain '{"name":"AK-47","thc_pct":"17-24%","cbd_pct":"0.2%","bank":"Serious Seeds","dominance":"Sativa","height_cm":"100-150","notes":"Híbrida con predominio sativa, larga duración.","ai_generated":false}'
add_strain '{"name":"Blue Cheese","thc_pct":"15-20%","cbd_pct":"0.5%","bank":"Big Buddha Seeds","dominance":"Índica","height_cm":"90-120","notes":"Aroma queso y arándanos, relajante y sedante.","ai_generated":false}'
add_strain '{"name":"Chemdawg","thc_pct":"15-26%","cbd_pct":"0.1%","bank":"Unknown","dominance":"Híbrida","height_cm":"100-150","notes":"Aroma químico intenso, efecto cerebral y físico.","ai_generated":false}'
add_strain '{"name":"Strawberry Cough","thc_pct":"15-25%","cbd_pct":"0.1%","bank":"Kyle Kushman","dominance":"Sativa","height_cm":"100-140","notes":"Aroma fresa dulce, efecto cerebral y social.","ai_generated":false}'
add_strain '{"name":"Super Silver Haze","thc_pct":"18-23%","cbd_pct":"0.1%","bank":"Greenhouse Seeds","dominance":"Sativa","height_cm":"150-200","notes":"Ganadora de múltiples Cannabis Cups, efecto creativo.","ai_generated":false}'
add_strain '{"name":"Chocolope","thc_pct":"18-25%","cbd_pct":"0.1%","bank":"DNA Genetics","dominance":"Sativa","height_cm":"150-200","notes":"Aroma cacao y café, efecto eufórico y cerebral.","ai_generated":false}'

echo ""
echo "==> ¡30 genéticas cargadas en genetics_db!"
