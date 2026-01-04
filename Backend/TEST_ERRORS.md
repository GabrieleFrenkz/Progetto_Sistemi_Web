# Guida al Testing della Gestione Errori

Questa guida mostra come testare tutti gli scenari di errore implementati nel backend.

## Prerequisiti

1. **Avvia il server Rails**:
```bash
cd Backend
rails server
```

2. **In un altro terminale**, esegui i comandi di test qui sotto.

---

## Metodo 1: Test con CURL (Immediato)

### 🔴 Test 400 - Bad Request (Parametro Mancante)

```bash
# Test: POST senza parametri richiesti
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 400
{
  "error": "Bad Request",
  "message": "param is missing or the value is empty: user",
  "details": "Required parameter missing: user"
}
```

---

### 🔴 Test 401 - Unauthorized (Non Autenticato)

```bash
# Test: Accesso a risorsa protetta senza token
curl -X GET http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 401
{
  "error": "Not authenticated"
}
```

```bash
# Test: Login con credenziali errate
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "email": "wrong@example.com",
      "password": "wrongpassword"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 401
{
  "error": "Invalid email or password"
}
```

---

### 🔴 Test 403 - Forbidden (Accesso Negato - Solo Admin)

Prima crea un utente normale e ottieni il token:

```bash
# 1. Registra un utente normale
RESPONSE=$(curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "email": "test@example.com",
      "password": "password123",
      "password_confirmation": "password123",
      "first_name": "Test",
      "last_name": "User"
    }
  }')

# 2. Estrai il token
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 3. Prova ad accedere a risorsa admin
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 403
{
  "error": "Access denied. Admin only."
}
```

---

### 🔴 Test 404 - Not Found (Risorsa Non Trovata)

```bash
# Test: Prodotto inesistente
curl -X GET http://localhost:3000/api/products/nonexistent_id_12345 \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 404
{
  "error": "Not Found",
  "message": "The requested resource was not found",
  "details": "Couldn't find Product with 'id'=nonexistent_id_12345"
}
```

---

### 🔴 Test 422 - Unprocessable Entity (Validazione Fallita)

```bash
# Test: Registrazione con dati invalidi
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "email": "invalid-email",
      "password": "123",
      "password_confirmation": "123",
      "first_name": "",
      "last_name": ""
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Risposta Attesa:**
```json
HTTP Status: 422
{
  "error": "Registration failed",
  "errors": [
    "Email is invalid",
    "First name can't be blank",
    "Last name can't be blank",
    "Password is too short (minimum is 6 characters)"
  ]
}
```

```bash
# Test: Aggiungere prodotto al carrello con quantità negativa
# (Prima ottieni un token valido come mostrato sopra)
curl -X POST http://localhost:3000/api/cart/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "product_id": "existing_product_id",
    "quantity": -5
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

---

### 🔴 Test 500 - Internal Server Error

Per testare un errore 500, dovresti simulare un'eccezione imprevista.
Questo è gestito automaticamente dal rescue_from StandardError.

---

## Metodo 2: Script Bash Automatico

Salva questo script e eseguilo:

```bash
#!/bin/bash

echo "=========================================="
echo "  TEST GESTIONE ERRORI - E-COMMERCE API"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_endpoint() {
    local name=$1
    local expected_status=$2
    local method=$3
    local endpoint=$4
    local data=$5
    local headers=$6

    echo -e "${YELLOW}Test: $name${NC}"
    echo "Endpoint: $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    else
        echo -e "${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $http_code"
    fi

    echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
    echo ""
}

# Test 400 - Bad Request
test_endpoint \
    "400 - Bad Request (Missing Parameter)" \
    "400" \
    "POST" \
    "/api/login" \
    '{}'

# Test 401 - Unauthorized
test_endpoint \
    "401 - Unauthorized (No Token)" \
    "401" \
    "GET" \
    "/api/cart"

test_endpoint \
    "401 - Unauthorized (Invalid Credentials)" \
    "401" \
    "POST" \
    "/api/login" \
    '{"user":{"email":"wrong@test.com","password":"wrong"}}'

# Test 404 - Not Found
test_endpoint \
    "404 - Not Found (Product)" \
    "404" \
    "GET" \
    "/api/products/nonexistent_12345"

# Test 422 - Unprocessable Entity
test_endpoint \
    "422 - Validation Failed" \
    "422" \
    "POST" \
    "/api/register" \
    '{"user":{"email":"invalid","password":"123","password_confirmation":"123","first_name":"","last_name":""}}'

echo "=========================================="
echo "  TESTS COMPLETED"
echo "=========================================="
```

Salvalo come `test_errors.sh` ed eseguilo:
```bash
chmod +x test_errors.sh
./test_errors.sh
```

---

## Metodo 3: Test con Postman

1. **Importa questa collezione** in Postman (File → Import → Raw Text):

```json
{
  "info": {
    "name": "E-commerce API - Error Testing",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "400 - Bad Request",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "http://localhost:3000/api/login",
        "body": {
          "mode": "raw",
          "raw": "{}"
        }
      }
    },
    {
      "name": "401 - Unauthorized (No Token)",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/cart"
      }
    },
    {
      "name": "401 - Invalid Credentials",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "http://localhost:3000/api/login",
        "body": {
          "mode": "raw",
          "raw": "{\"user\":{\"email\":\"wrong@test.com\",\"password\":\"wrong\"}}"
        }
      }
    },
    {
      "name": "404 - Not Found",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/products/nonexistent_12345"
      }
    },
    {
      "name": "422 - Validation Failed",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "http://localhost:3000/api/register",
        "body": {
          "mode": "raw",
          "raw": "{\"user\":{\"email\":\"invalid\",\"password\":\"123\",\"password_confirmation\":\"123\",\"first_name\":\"\",\"last_name\":\"\"}}"
        }
      }
    }
  ]
}
```

---

## Metodo 4: Test Automatici con RSpec (Opzionale)

Se vuoi creare test automatici veri e propri, crea questo file:

`spec/requests/error_handling_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe 'Error Handling', type: :request do
  describe 'HTTP Status Codes' do

    # 400 - Bad Request
    it 'returns 400 for missing parameters' do
      post '/api/login', params: {}
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Bad Request')
    end

    # 401 - Unauthorized
    it 'returns 401 for unauthenticated requests' do
      get '/api/cart'
      expect(response).to have_http_status(:unauthorized)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Not authenticated')
    end

    # 404 - Not Found
    it 'returns 404 for non-existent resources' do
      get '/api/products/nonexistent'
      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Not Found')
    end

    # 422 - Unprocessable Entity
    it 'returns 422 for validation errors' do
      post '/api/register', params: {
        user: {
          email: 'invalid',
          password: '123',
          password_confirmation: '123',
          first_name: '',
          last_name: ''
        }
      }
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Registration failed')
      expect(json['errors']).to be_an(Array)
    end
  end
end
```

Esegui con:
```bash
bundle exec rspec spec/requests/error_handling_spec.rb
```

---

## Checklist di Test Completa

- [ ] 400 - Parametri mancanti in POST
- [ ] 401 - Accesso senza token
- [ ] 401 - Credenziali errate
- [ ] 403 - Utente normale tenta accesso admin
- [ ] 404 - Prodotto inesistente
- [ ] 404 - Ordine inesistente
- [ ] 422 - Email invalida in registrazione
- [ ] 422 - Password troppo corta
- [ ] 422 - Campi required vuoti
- [ ] 422 - Quantità negativa nel carrello

---

## Tips per il Testing

1. **Usa `jq` per formattare JSON**: Installa con `brew install jq` (Mac) o `apt install jq` (Linux)
2. **Controlla i log Rails**: `tail -f log/development.log`
3. **Usa Postman Collections** per salvare e riutilizzare i test
4. **Verifica gli header HTTP** con curl aggiungendo `-i` flag

---

## Esempio Output Atteso

```bash
$ curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{}' -i

HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "error": "Bad Request",
  "message": "param is missing or the value is empty: user",
  "details": "Required parameter missing: user"
}
```
