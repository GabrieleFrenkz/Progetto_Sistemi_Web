# 🧪 Come Testare la Gestione Errori

Hai 3 file a disposizione per testare tutti gli scenari di errore HTTP:

## File Disponibili

1. **TEST_ERRORS.md** - Documentazione completa con esempi
2. **test_errors.sh** - Script bash automatico
3. **Postman_Error_Tests.json** - Collezione Postman/Insomnia

---

## ⚡ Metodo 1: Script Automatico (CONSIGLIATO)

### Passo 1: Avvia il server Rails

```bash
cd Backend
rails server
```

### Passo 2: In un altro terminale, esegui lo script

```bash
cd Backend
./test_errors.sh
```

### Output Atteso

Lo script testerà automaticamente tutti gli scenari e mostrerà:
- ✅ Test passati (in verde)
- ❌ Test falliti (in rosso)
- Risposta JSON completa per ogni test
- Summary finale con conteggio pass/fail

---

## 📮 Metodo 2: Postman/Insomnia

### Passo 1: Importa la collezione

1. Apri **Postman** o **Insomnia**
2. Click su **Import**
3. Seleziona il file `Postman_Error_Tests.json`

### Passo 2: Testa gli endpoint

La collezione è organizzata per status code:
- 📁 **400 - Bad Request**
- 📁 **401 - Unauthorized**
- 📁 **403 - Forbidden**
- 📁 **404 - Not Found**
- 📁 **422 - Unprocessable Entity**
- 📁 **Helper - Get User Token**

### Passo 3: Per testare 403 (Forbidden)

1. Prima esegui: **Helper → Register Normal User**
2. Questo salva automaticamente il token in una variabile
3. Poi esegui: **403 - Forbidden → Non-Admin Access to Admin Resource**

---

## 📖 Metodo 3: Comandi Manuali

Apri `TEST_ERRORS.md` per vedere tutti i comandi curl da copiare-incollare.

### Esempio rapido

```bash
# Test 400
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n"

# Test 401
curl -X GET http://localhost:3000/api/cart \
  -w "\nHTTP Status: %{http_code}\n"

# Test 404
curl -X GET http://localhost:3000/api/products/nonexistent \
  -w "\nHTTP Status: %{http_code}\n"
```

---

## 🎯 Checklist di Test

Assicurati di testare tutti questi scenari:

### Status 400 - Bad Request
- [ ] POST /api/login senza parametri
- [ ] POST /api/register senza campo "user"

### Status 401 - Unauthorized
- [ ] GET /api/cart senza token
- [ ] POST /api/login con credenziali errate
- [ ] GET /api/me con token scaduto/invalido

### Status 403 - Forbidden
- [ ] Utente normale accede a /api/admin/stats
- [ ] Utente normale tenta DELETE /api/admin/products/:id

### Status 404 - Not Found
- [ ] GET /api/products/nonexistent_id
- [ ] GET /api/admin/orders/99999

### Status 422 - Unprocessable Entity
- [ ] POST /api/register con email invalida
- [ ] POST /api/register con password < 6 caratteri
- [ ] POST /api/register senza first_name e last_name
- [ ] POST /api/cart/items con quantità negativa

---

## 🔍 Debugging

### Se i test falliscono

1. **Verifica che il server sia in esecuzione**:
   ```bash
   curl http://localhost:3000/up
   ```

2. **Controlla i log di Rails**:
   ```bash
   tail -f log/development.log
   ```

3. **Verifica che il database sia migrato**:
   ```bash
   rails db:migrate
   ```

4. **Se test_errors.sh non funziona**:
   - Assicurati che sia eseguibile: `chmod +x test_errors.sh`
   - Verifica che Python3 sia installato (per formattare JSON)
   - Se non hai Python3, lo script funziona comunque ma il JSON non sarà formattato

---

## 📊 Interpretare i Risultati

### Risposta di Successo

```bash
✓ PASS - Status: 400 (Expected: 400)
Response:
{
  "error": "Bad Request",
  "message": "param is missing or the value is empty: user",
  "details": "Required parameter missing: user"
}
```

### Risposta di Errore

```bash
✗ FAIL - Expected: 400, Got: 200
Response:
{
  ... risposta inattesa ...
}
```

Se vedi un FAIL, controlla:
1. Il codice del controller
2. I log di Rails
3. Che la richiesta contenga esattamente i parametri mostrati

---

## 💡 Tips

1. **Usa lo script automatico** per verificare rapidamente tutto
2. **Usa Postman** per esplorare manualmente e debuggare
3. **Usa curl manuale** quando vuoi testare un caso specifico
4. **Controlla sempre i log** quando qualcosa non funziona come atteso

---

## ✅ Output Atteso dello Script

```bash
==========================================
  TEST GESTIONE ERRORI - E-COMMERCE API
==========================================

✓ Server Rails attivo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test: 400 - Bad Request (Parametro Mancante)
Endpoint: POST /api/login
✓ PASS - Status: 400 (Expected: 400)
Response:
{
  "error": "Bad Request",
  "message": "param is missing or the value is empty: user",
  "details": "Required parameter missing: user"
}

... (altri test) ...

==========================================
           TEST SUMMARY
==========================================
Passed: 6
Failed: 0
Total:  6

✓ Tutti i test sono passati!

Status HTTP verificati:
  ✓ 400 Bad Request
  ✓ 401 Unauthorized
  ✓ 403 Forbidden
  ✓ 404 Not Found
  ✓ 422 Unprocessable Entity
```

---

## 🚀 Quick Start

```bash
# 1. Avvia Rails (terminale 1)
cd Backend
rails server

# 2. Esegui test (terminale 2)
cd Backend
./test_errors.sh
```

Done! 🎉
