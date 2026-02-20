# Architettura del Sistema E-Commerce

Questo documento descrive l'architettura dell'applicazione e-commerce, includendo i modelli del dominio, i flussi principali e le funzionalità avanzate implementate.

## Indice

- [Panoramica Architetturale](#panoramica-architetturale)
- [Modelli del Dominio](#modelli-del-dominio)
- [Flussi Principali](#flussi-principali)
- [Funzionalità Avanzate](#funzionalità-avanzate)
- [Sistema di Autenticazione](#sistema-di-autenticazione)
- [Gestione dello Stato](#gestione-dello-stato)
- [Sicurezza](#sicurezza)

## Panoramica Architetturale

L'applicazione segue un'architettura client-server con separazione completa tra frontend e backend:

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                    Angular 21 (SPA)                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐  │
│  │  Components│  │  Services  │  │  Guards & Routing   │  │
│  │            │  │            │  │                     │  │
│  │ - Products │  │ - Auth API │  │ - AuthGuard         │  │
│  │ - Cart     │  │ - Product  │  │ - AdminGuard        │  │
│  │ - Checkout │  │ - Cart     │  │ - CartGuard         │  │
│  │ - Admin    │  │ - Order    │  │ - Route Config      │  │
│  └────────────┘  └────────────┘  └─────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST + JWT
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                        BACKEND                               │
│                   Rails 8.1.1 (API)                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐  │
│  │Controllers │  │   Models   │  │   Authentication    │  │
│  │            │  │            │  │                     │  │
│  │ - Products │  │ - Product  │  │ - JWT Generation    │  │
│  │ - Carts    │  │ - Cart     │  │ - Token Validation  │  │
│  │ - Orders   │  │ - Order    │  │ - Role-based Auth   │  │
│  │ - Admin    │  │ - User     │  │ - bcrypt Hashing    │  │
│  └────────────┘  └────────────┘  └─────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   SQLite3 DB   │
              │                │
              │  - Users       │
              │  - Products    │
              │  - Carts       │
              │  - Orders      │
              │  - Wishlists   │
              └────────────────┘
```

### Principi Architetturali

1. **Separazione delle Responsabilità**: Frontend e backend completamente separati
2. **RESTful API**: Comunicazione tramite endpoint REST standard
3. **Stateless Backend**: Il backend non mantiene stato di sessione (JWT tokens)
4. **Reactive Frontend**: Uso di RxJS Observable per gestione asincrona
5. **Component-Based UI**: Angular components riutilizzabili e modulari

## Modelli del Dominio

### Diagramma delle Entità

```
┌─────────────┐
│    User     │
│─────────────│
│ id          │
│ email       │◄────────┐
│ password    │         │
│ first_name  │         │
│ last_name   │         │ 1
│ address     │         │
│ role        │         │
└─────────────┘         │
      │                 │
      │ 1               │
      │                 │
      │ *               │
┌─────▼─────┐    ┌──────┴──────┐
│   Order   │    │    Cart     │
│───────────│    │─────────────│
│ id        │    │ id          │
│ user_id   │    │ user_id     │
│ customer  │    │ expires_at  │
│ address   │    └──────┬──────┘
│ total     │           │
└─────┬─────┘           │ 1
      │                 │
      │ 1               │
      │                 │
      │ *               │ *
┌─────▼─────┐    ┌──────▼──────┐
│ OrderItem │    │  CartItem   │
│───────────│    │─────────────│
│ id        │    │ id          │
│ order_id  │    │ cart_id     │
│ product_id│◄───┤ product_id  │
│ quantity  │    │ quantity    │
│ unit_price│    │ unit_price  │
└─────┬─────┘    └──────┬──────┘
      │                 │
      │                 │
      │        ┌────────┘
      │        │
      │ *      │ *
┌─────▼────────▼──┐
│    Product      │
│─────────────────│
│ id (string)     │
│ title           │
│ description     │
│ price           │
│ original_price  │
│ quantity        │
│ sale            │
│ thumbnail       │
│ tags (JSON)     │
└─────────────────┘
      ▲
      │ *
      │
      │ 1
┌─────┴─────┐         ┌─────────────┐
│ Wishlist  │◄────────│    User     │
│   Item    │    1    │             │
│───────────│         │ (riferito)  │
│ id        │         └─────────────┘
│ wishlist  │
│ product_id│
└───────────┘
```

### Descrizione delle Entità

#### User (Utente)

Rappresenta un utente del sistema, che può essere un cliente o un amministratore.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `email`: Email univoca per l'autenticazione (String)
- `password_digest`: Hash bcrypt della password (String)
- `first_name`: Nome dell'utente (String)
- `last_name`: Cognome dell'utente (String)
- `address`: Indirizzo di spedizione predefinito (Text)
- `role`: Ruolo dell'utente ('user' o 'admin') (String)

**Relazioni:**
- `has_many :orders` - Un utente può avere molti ordini
- `has_one :cart` - Un utente ha un carrello
- `has_one :wishlist` - Un utente ha una wishlist

**Validazioni:**
- Email: formato valido e univocità
- Password: lunghezza minima di 6 caratteri
- Role: deve essere 'user' o 'admin'

#### Product (Prodotto)

Rappresenta un prodotto disponibile nel catalogo.

**Attributi:**
- `id`: Identificatore univoco (String, ereditato dal sistema di mock)
- `title`: Nome del prodotto (String)
- `description`: Descrizione dettagliata (Text)
- `price`: Prezzo corrente (Decimal 10,2)
- `original_price`: Prezzo originale prima dello sconto (Decimal 10,2)
- `quantity`: Quantità disponibile in magazzino (Integer)
- `sale`: Flag per indicare se il prodotto è in offerta (Boolean)
- `thumbnail`: URL dell'immagine (String)
- `tags`: Array di tag per categorizzazione (JSON Array)
- `created_at`: Data di creazione (DateTime)
- `updated_at`: Data di ultimo aggiornamento (DateTime)

**Relazioni:**
- `has_many :cart_items` - Presente in molti carrelli
- `has_many :order_items` - Presente in molti ordini
- `has_many :wishlist_items` - Presente in molte wishlist

**Metodi:**
- `in_stock?`: Verifica se il prodotto è disponibile
- `out_of_stock?`: Verifica se il prodotto è esaurito

#### Cart (Carrello)

Rappresenta il carrello della spesa di un utente o di un guest.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `user_id`: ID dell'utente proprietario (Integer, nullable per guest)
- `session_token`: Token per carrelli guest (String, nullable)
- `expires_at`: Data di scadenza del carrello (DateTime)
- `created_at`: Data di creazione (DateTime)
- `updated_at`: Data di ultimo aggiornamento (DateTime)

**Relazioni:**
- `belongs_to :user` (opzionale)
- `has_many :cart_items`
- `has_many :products, through: :cart_items`

**Metodi:**
- `total()`: Calcola il totale del carrello
- `item_count()`: Conta il numero di item nel carrello
- `empty?()`: Verifica se il carrello è vuoto
- `clear_items()`: Svuota il carrello

**Funzionalità:**
- Supporto per utenti autenticati e guest
- Scadenza automatica dei carrelli guest dopo un periodo

#### CartItem (Elemento del Carrello)

Rappresenta un prodotto specifico all'interno di un carrello.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `cart_id`: ID del carrello (Integer)
- `product_id`: ID del prodotto (String)
- `quantity`: Quantità del prodotto (Integer)
- `unit_price`: Prezzo unitario al momento dell'aggiunta (Decimal 10,2)

**Relazioni:**
- `belongs_to :cart`
- `belongs_to :product`

**Validazioni:**
- Quantità: deve essere positiva
- Disponibilità: verifica stock prima dell'aggiunta
- Unicità: un prodotto può apparire una sola volta per carrello (composite unique index)

#### Order (Ordine)

Rappresenta un ordine completato da un utente.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `user_id`: ID dell'utente (Integer, opzionale per ordini guest)
- `customer`: Dati del cliente in formato JSON (JSON)
  - `first_name`, `last_name`, `email`, `phone`
- `address`: Indirizzo di spedizione in formato JSON (JSON)
  - `street`, `city`, `postal_code`, `country`
- `total`: Totale dell'ordine (Decimal 10,2)
- `created_at`: Data di creazione/ordine (DateTime)
- `updated_at`: Data di ultimo aggiornamento (DateTime)

**Relazioni:**
- `belongs_to :user` (opzionale)
- `has_many :order_items`
- `has_many :products, through: :order_items`

**Callbacks:**
- `before_destroy`: Ripristina le quantità dei prodotti in magazzino

#### OrderItem (Elemento dell'Ordine)

Rappresenta un prodotto specifico all'interno di un ordine.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `order_id`: ID dell'ordine (Integer)
- `product_id`: ID del prodotto (String)
- `quantity`: Quantità ordinata (Integer)
- `unit_price`: Prezzo unitario al momento dell'ordine (Decimal 10,2)

**Relazioni:**
- `belongs_to :order`
- `belongs_to :product`

**Validazioni:**
- Unicità: un prodotto può apparire una sola volta per ordine (composite unique index)

#### Wishlist (Lista dei Desideri)

Rappresenta la lista dei prodotti desiderati da un utente.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `user_id`: ID dell'utente (Integer, unique)
- `created_at`: Data di creazione (DateTime)
- `updated_at`: Data di ultimo aggiornamento (DateTime)

**Relazioni:**
- `belongs_to :user`
- `has_many :wishlist_items`
- `has_many :products, through: :wishlist_items`

**Metodi:**
- `item_count()`: Conta il numero di prodotti nella wishlist
- `empty?()`: Verifica se la wishlist è vuota
- `includes_product?(product_id)`: Verifica se un prodotto è nella wishlist
- `clear_items()`: Svuota la wishlist

#### WishlistItem (Elemento della Wishlist)

Rappresenta un prodotto nella wishlist di un utente.

**Attributi:**
- `id`: Identificatore univoco (Integer)
- `wishlist_id`: ID della wishlist (Integer)
- `product_id`: ID del prodotto (String)
- `created_at`: Data di aggiunta (DateTime)
- `updated_at`: Data di ultimo aggiornamento (DateTime)

**Relazioni:**
- `belongs_to :wishlist`
- `belongs_to :product`

**Validazioni:**
- Unicità: un prodotto può apparire una sola volta per wishlist (composite unique index)

## Flussi Principali

### 1. Flusso di Registrazione e Login

```
┌──────────┐
│  Utente  │
└────┬─────┘
     │
     ├─ REGISTRAZIONE ──────────────────────────────────────┐
     │                                                        │
     │  1. Compila form registrazione                        │
     │     - Email, Password, Nome, Cognome, Indirizzo       │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  RegisterPage   │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  2. POST /api/register                                │
     │     { email, password, first_name, last_name, ... }   │
     │                                                        │
     ▼                                                        │
┌──────────────────────────┐                                 │
│ AuthenticationController │                                 │
│       (Backend)          │                                 │
└────┬─────────────────────┘                                 │
     │                                                        │
     │  3. Valida dati                                       │
     │  4. Hash password (bcrypt)                            │
     │  5. Crea User record                                  │
     │  6. Genera JWT token                                  │
     │     - Payload: { user_id, role, exp }                 │
     │     - Algoritmo: HS256                                │
     │                                                        │
     │  7. Response: { user, token }                         │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  AuthService    │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  8. Salva token in localStorage                       │
     │  9. Salva user info                                   │
     │ 10. Redirect a /products                              │
     │                                                        │
     └────────────────────────────────────────────────────────┘

     ├─ LOGIN ──────────────────────────────────────────────┐
     │                                                        │
     │  1. Compila form login (Email, Password)              │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│   LoginPage     │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  2. POST /api/login                                   │
     │     { email, password }                               │
     │                                                        │
     ▼                                                        │
┌──────────────────────────┐                                 │
│ AuthenticationController │                                 │
│       (Backend)          │                                 │
└────┬─────────────────────┘                                 │
     │                                                        │
     │  3. Trova User by email                               │
     │  4. Verifica password (bcrypt.compare)                │
     │  5. Genera JWT token                                  │
     │                                                        │
     │  6. Response: { user, token }                         │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  AuthService    │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  7. Salva token in localStorage                       │
     │  8. Merge carrello guest con carrello utente          │
     │  9. Redirect a pagina precedente o /products          │
     │                                                        │
     └────────────────────────────────────────────────────────┘
```

**Token JWT Payload:**
```json
{
  "user_id": 123,
  "role": "user",
  "exp": 1736899200
}
```

### 2. Flusso Navigazione Prodotti e Ricerca

```
┌──────────┐
│  Utente  │
└────┬─────┘
     │
     │  1. Accede a /products
     │
     ▼
┌─────────────────┐
│  ProductPage    │
│   (Frontend)    │
└────┬────────────┘
     │
     │  2. Può applicare filtri:
     │     - Ricerca per titolo
     │     - Range di prezzo (min/max)
     │     - Ordinamento (prezzo, data)
     │
     │  3. GET /api/products?title=laptop&minPrice=500&sort=price_asc
     │
     ▼
┌──────────────────────────┐
│  ProductsController      │
│       (Backend)          │
└────┬─────────────────────┘
     │
     │  4. Query database con filtri:
     │     - WHERE title LIKE '%laptop%'
     │     - AND price >= 500
     │     - ORDER BY price ASC
     │
     │  5. Response: [ { id, title, price, ... }, ... ]
     │
     ▼
┌─────────────────┐
│  ProductPage    │
│   (Frontend)    │
└────┬────────────┘
     │
     │  6. Applica paginazione lato client
     │     - combineLatest([products$, page$])
     │     - Slice array per pagina corretta
     │
     │  7. Mostra prodotti in card
     │     - Thumbnail, titolo, prezzo
     │     - Badge "In offerta" se sale=true
     │     - Badge "Esaurito" se quantity=0
     │
     │  8. Utente clicca su prodotto
     │
     ▼
┌─────────────────────────┐
│  ProductDetailPage      │
│      (Frontend)         │
└────┬────────────────────┘
     │
     │  9. GET /api/products/:id
     │
     ▼
┌──────────────────────────┐
│  ProductsController      │
│       (Backend)          │
└────┬─────────────────────┘
     │
     │ 10. Response: { id, title, description, price, ... }
     │
     ▼
┌─────────────────────────┐
│  ProductDetailPage      │
│      (Frontend)         │
└────┬────────────────────┘
     │
     │ 11. Mostra dettagli completi:
     │     - Immagine grande
     │     - Descrizione completa
     │     - Prezzo e disponibilità
     │     - Bottoni: Aggiungi al carrello, Wishlist
     │
     └─────────────────────────────────────────────────────┘
```

**Funzionalità di Ricerca:**
- **Debouncing**: Input utente con debounce di 300ms per ridurre chiamate API
- **Reactive Search**: Observable che reagisce ai cambiamenti dei filtri
- **Multi-filter**: Combinazione di titolo, prezzo min/max, ordinamento

### 3. Flusso Carrello → Checkout → Ordine

```
┌──────────┐
│  Utente  │
└────┬─────┘
     │
     ├─ AGGIUNTA AL CARRELLO ────────────────────────────────┐
     │                                                        │
     │  1. Clicca "Aggiungi al carrello"                     │
     │     su ProductCard o ProductDetailPage                │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  CartService    │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  2. POST /api/cart/items                              │
     │     Headers:                                          │
     │       - Authorization: Bearer <token> (se loggato)    │
     │       - X-Session-Token: <uuid> (se guest)            │
     │     Body: { product_id, quantity }                    │
     │                                                        │
     ▼                                                        │
┌──────────────────────────┐                                 │
│     CartsController      │                                 │
│       (Backend)          │                                 │
└────┬─────────────────────┘                                 │
     │                                                        │
     │  3. Trova o crea Cart                                 │
     │     - Se autenticato: Cart.find_by(user: current_user)│
     │     - Se guest: Cart.find_by(session_token: token)    │
     │                                                        │
     │  4. Verifica disponibilità prodotto                   │
     │     - product.in_stock?                               │
     │     - product.quantity >= requested_quantity          │
     │                                                        │
     │  5. Crea o aggiorna CartItem                          │
     │     - Se esiste: aumenta quantity                     │
     │     - Se nuovo: crea CartItem                         │
     │                                                        │
     │  6. Response: { cart: {...}, items: [...], total }    │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  Frontend       │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  7. Mostra Snackbar: "Prodotto aggiunto al carrello"  │
     │     con azione "Visualizza Carrello"                  │
     │                                                        │
     └────────────────────────────────────────────────────────┘

     ├─ VISUALIZZAZIONE CARRELLO ────────────────────────────┐
     │                                                        │
     │  1. Naviga a /cart                                    │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│   CartPage      │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  2. GET /api/cart                                     │
     │                                                        │
     ▼                                                        │
┌──────────────────────────┐                                 │
│     CartsController      │                                 │
│       (Backend)          │                                 │
└────┬─────────────────────┘                                 │
     │                                                        │
     │  3. Response: {                                       │
     │       cart: { id, ... },                              │
     │       items: [{ id, product, quantity, unit_price }], │
     │       total: 1234.56                                  │
     │     }                                                 │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│   CartPage      │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  4. Mostra lista prodotti nel carrello:               │
     │     - Thumbnail e nome prodotto                       │
     │     - Prezzo unitario e subtotale                     │
     │     - Controlli quantità (+/-)                        │
     │     - Bottone rimuovi                                 │
     │                                                        │
     │  5. Mostra riepilogo:                                 │
     │     - Subtotale                                       │
     │     - Totale                                          │
     │     - Bottone "Procedi al Checkout"                   │
     │                                                        │
     │  6. Utente può:                                       │
     │     - Modificare quantità:                            │
     │       PATCH /api/cart/items/:id { quantity: N }       │
     │     - Rimuovere prodotto:                             │
     │       DELETE /api/cart/items/:id                      │
     │     - Svuotare carrello:                              │
     │       DELETE /api/cart                                │
     │                                                        │
     └────────────────────────────────────────────────────────┘

     ├─ CHECKOUT ────────────────────────────────────────────┐
     │                                                        │
     │  1. Clicca "Procedi al Checkout"                      │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  CheckoutPage   │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │  2. Guard verifica:                                   │
     │     - Utente autenticato                              │
     │     - Carrello non vuoto                              │
     │                                                        │
     │  3. Carica dati carrello (GET /api/cart)              │
     │                                                        │
     │  4. Mostra form checkout:                             │
     │     - Riepilogo ordine (prodotti, quantità, prezzi)   │
     │     - Dati cliente (precompilati se user loggato)     │
     │     - Indirizzo di spedizione                         │
     │     - Totale ordine                                   │
     │                                                        │
     │  5. Utente compila/conferma dati e clicca "Ordina"    │
     │                                                        │
     │  6. POST /api/orders                                  │
     │     Body: {                                           │
     │       customer: { first_name, last_name, email, ... },│
     │       address: { street, city, postal_code, ... },    │
     │       items: [ { product_id, quantity }, ... ]        │
     │     }                                                 │
     │                                                        │
     ▼                                                        │
┌──────────────────────────┐                                 │
│     OrdersController     │                                 │
│       (Backend)          │                                 │
└────┬─────────────────────┘                                 │
     │                                                        │
     │  7. Validazioni:                                      │
     │     - Carrello non vuoto                              │
     │     - Tutti i prodotti disponibili                    │
     │     - Quantità in stock sufficienti                   │
     │                                                        │
     │  8. Transazione database:                             │
     │     - Crea Order record                               │
     │     - Crea OrderItems da CartItems                    │
     │     - Decrementa quantità prodotti:                   │
     │         product.quantity -= ordered_quantity          │
     │     - Svuota carrello (cart.clear_items)              │
     │                                                        │
     │  9. Response: {                                       │
     │       order: { id, total, created_at, items: [...] }  │
     │     }                                                 │
     │                                                        │
     ▼                                                        │
┌─────────────────┐                                          │
│  CheckoutPage   │                                          │
│   (Frontend)    │                                          │
└────┬────────────┘                                          │
     │                                                        │
     │ 10. Mostra messaggio successo                         │
     │ 11. Redirect a /orders (storico ordini)               │
     │                                                        │
     └────────────────────────────────────────────────────────┘

     └─ STORICO ORDINI ──────────────────────────────────────┐
                                                              │
        1. Naviga a /orders                                  │
                                                              │
        ▼                                                     │
   ┌─────────────────┐                                       │
   │ OrderHistoryPage│                                       │
   │   (Frontend)    │                                       │
   └────┬────────────┘                                       │
        │                                                     │
        │  2. GET /api/orders                                │
        │                                                     │
        ▼                                                     │
   ┌──────────────────────────┐                              │
   │     OrdersController     │                              │
   │       (Backend)          │                              │
   └────┬─────────────────────┘                              │
        │                                                     │
        │  3. Response: [                                    │
        │       {                                            │
        │         id, total, created_at,                     │
        │         items: [ { product, quantity, price } ]    │
        │       },                                           │
        │       ...                                          │
        │     ]                                              │
        │                                                     │
        ▼                                                     │
   ┌─────────────────┐                                       │
   │ OrderHistoryPage│                                       │
   │   (Frontend)    │                                       │
   └────┬────────────┘                                       │
        │                                                     │
        │  4. Mostra lista ordini:                           │
        │     - Data ordine                                  │
        │     - Numero ordine                                │
        │     - Totale                                       │
        │     - Lista prodotti ordinati                      │
        │     - Quantità e prezzi                            │
        │                                                     │
        └────────────────────────────────────────────────────┘
```

**Gestione Inventario nel Flusso:**
- **Aggiunta al carrello**: Verifica disponibilità, NON decrementa stock
- **Checkout/Creazione ordine**: Decrementa stock per tutti i prodotti
- **Cancellazione ordine**: Ripristina stock (before_destroy callback)

### 4. Flusso Wishlist

```
┌──────────┐
│  Utente  │
│(loggato) │
└────┬─────┘
     │
     │  1. Clicca icona cuore su ProductCard/DetailPage
     │
     ▼
┌─────────────────┐
│ WishlistService │
│   (Frontend)    │
└────┬────────────┘
     │
     │  2. POST /api/wishlist/items
     │     Headers: Authorization: Bearer <token>
     │     Body: { product_id }
     │
     ▼
┌──────────────────────────┐
│  WishlistsController     │
│       (Backend)          │
└────┬─────────────────────┘
     │
     │  3. Trova o crea Wishlist per utente
     │  4. Crea WishlistItem
     │  5. Response: { wishlist: {...}, items: [...] }
     │
     ▼
┌─────────────────┐
│   Frontend      │
└────┬────────────┘
     │
     │  6. Aggiorna icona cuore (pieno)
     │  7. Snackbar: "Prodotto aggiunto alla wishlist"
     │
     │
     │  8. Utente naviga a /wishlist
     │
     ▼
┌─────────────────┐
│  WishlistPage   │
│   (Frontend)    │
└────┬────────────┘
     │
     │  9. GET /api/wishlist
     │
     ▼
┌──────────────────────────┐
│  WishlistsController     │
│       (Backend)          │
└────┬─────────────────────┘
     │
     │ 10. Response: {
     │       wishlist: {...},
     │       items: [ { product, added_at }, ... ]
     │     }
     │
     ▼
┌─────────────────┐
│  WishlistPage   │
│   (Frontend)    │
└────┬────────────┘
     │
     │ 11. Mostra lista prodotti desiderati
     │ 12. Bottoni: "Aggiungi al carrello", "Rimuovi"
     │
     │ 13. Rimozione: DELETE /api/wishlist/items/:id
     │
     └─────────────────────────────────────────────────────┘
```

### 5. Flusso Admin Dashboard

```
┌──────────┐
│  Admin   │
└────┬─────┘
     │
     │  1. Login con ruolo 'admin'
     │  2. Naviga a /admin
     │
     ▼
┌─────────────────┐
│  AdminGuard     │
│   (Frontend)    │
└────┬────────────┘
     │
     │  3. Verifica: current_user.role === 'admin'
     │     Se false: redirect a /products
     │
     ▼
┌─────────────────────────┐
│   AdminDashboard        │
│      (Frontend)         │
└────┬────────────────────┘
     │
     │  4. GET /api/admin/stats
     │
     ▼
┌──────────────────────────┐
│ Admin::OrdersController  │
│       (Backend)          │
└────┬─────────────────────┘
     │
     │  5. Calcola statistiche:
     │     - Totale vendite
     │     - Numero ordini
     │     - Prodotti più venduti
     │     - Revenue per periodo
     │
     │  6. Response: { total_revenue, orders_count, ... }
     │
     ▼
┌─────────────────────────┐
│   AdminDashboard        │
│      (Frontend)         │
└────┬────────────────────┘
     │
     │  7. Mostra dashboard:
     │     - Cards con statistiche
     │     - Tabella prodotti (con edit/delete)
     │     - Tabella ordini
     │     - Form crea/modifica prodotto
     │
     │
     ├─ GESTIONE PRODOTTI ──────────────────────────────────┐
     │                                                        │
     │  Crea Prodotto:                                       │
     │    POST /api/admin/products                           │
     │    Body: { title, description, price, quantity, ... } │
     │                                                        │
     │  Modifica Prodotto:                                   │
     │    PATCH /api/admin/products/:id                      │
     │    Body: { price: 999.99, quantity: 50 }              │
     │                                                        │
     │  Modifica Quantità:                                   │
     │    PATCH /api/admin/products/:id/adjust_quantity      │
     │    Body: { adjustment: +10 } o { adjustment: -5 }     │
     │                                                        │
     │  Elimina Prodotto:                                    │
     │    DELETE /api/admin/products/:id                     │
     │                                                        │
     └────────────────────────────────────────────────────────┘
     │
     ├─ GESTIONE ORDINI ────────────────────────────────────┐
     │                                                        │
     │  Lista tutti gli ordini:                              │
     │    GET /api/admin/orders                              │
     │    Response: [ { id, user, items, total }, ... ]      │
     │                                                        │
     │  Dettaglio ordine:                                    │
     │    GET /api/admin/orders/:id                          │
     │                                                        │
     │  Elimina ordine:                                      │
     │    DELETE /api/admin/orders/:id                       │
     │    (ripristina automaticamente lo stock)              │
     │                                                        │
     └────────────────────────────────────────────────────────┘
```

## Funzionalità Avanzate

### 1. Sistema di Autenticazione JWT

**Caratteristiche:**
- Token JWT con scadenza 24 ore
- Hashing password con bcrypt (cost factor 12)
- Refresh automatico del token (implementabile)
- Protezione CSRF tramite token stateless
- Role-based access control (user/admin)

**Implementazione:**
```ruby
# Backend: JWT Generation
def generate_token(user)
  payload = {
    user_id: user.id,
    role: user.role,
    exp: 24.hours.from_now.to_i
  }
  JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
end
```

### 2. Carrello Guest (Sessioni Anonime)

**Problema risolto**: Permettere agli utenti non autenticati di aggiungere prodotti al carrello.

**Soluzione**:
- Generazione di un `session_token` UUID sul frontend
- Invio del token nell'header `X-Session-Token`
- Backend crea Cart associato al session_token invece che a user_id
- Al login, merge del carrello guest con quello dell'utente

**Implementazione Frontend:**
```typescript
// Genera o recupera session token
private getOrCreateSessionToken(): string {
  let token = localStorage.getItem('session_token');
  if (!token) {
    token = this.generateUUID();
    localStorage.setItem('session_token', token);
  }
  return token;
}

// HTTP Interceptor aggiunge header
headers = headers.set('X-Session-Token', this.getOrCreateSessionToken());
```

**Implementazione Backend:**
```ruby
def current_cart
  if current_user
    current_user.cart || current_user.create_cart
  elsif session_token
    Cart.find_or_create_by(session_token: session_token)
  end
end
```

### 3. Gestione Inventario in Tempo Reale

**Caratteristiche:**
- Verifica disponibilità prima di aggiungere al carrello
- Decremento stock solo al completamento dell'ordine
- Ripristino stock automatico alla cancellazione dell'ordine
- Validazione quantità richiesta vs disponibile

**Implementazione:**
```ruby
# Model: Product
def in_stock?
  quantity.present? && quantity > 0
end

# Controller: CartsController
def add_item
  product = Product.find(params[:product_id])

  unless product.in_stock?
    return render json: { error: 'Product out of stock' }, status: :unprocessable_entity
  end

  if product.quantity < requested_quantity
    return render json: { error: 'Insufficient stock' }, status: :unprocessable_entity
  end

  # Aggiungi al carrello (NON decrementa stock)
  cart.add_item(product, quantity)
end

# Controller: OrdersController
def create
  # Al checkout, decrementa stock
  order.items.each do |item|
    item.product.update!(quantity: item.product.quantity - item.quantity)
  end
end

# Model: Order
before_destroy :restore_quantities

def restore_quantities
  order_items.each do |item|
    product = item.product
    product.update(quantity: product.quantity + item.quantity)
  end
end
```

### 4. Ricerca e Filtri Avanzati

**Funzionalità:**
- Ricerca testuale (LIKE query su title)
- Filtro per range di prezzo (min/max)
- Ordinamento multiplo (prezzo, data, crescente/decrescente)
- Debouncing input per ridurre chiamate API
- Paginazione lato frontend

**Implementazione Frontend (RxJS):**
```typescript
filteredProducts$ = this.filters$.pipe(
  debounceTime(300),                    // Attendi 300ms dopo ultimo input
  distinctUntilChanged(),               // Skip se filtri non cambiati
  switchMap(filters => {                // Nuova richiesta API
    return this.service.list({
      title: filters.title,
      minPrice: filters.priceMin,
      maxPrice: filters.priceMax,
      sort: filters.sort
    });
  })
);

// Paginazione reattiva
paged$ = combineLatest([this.filteredProducts$, this.page$]).pipe(
  map(([items, page]) => {
    const start = (page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return items.slice(start, end);
  })
);
```

**Implementazione Backend:**
```ruby
def index
  products = Product.all

  # Filtro per titolo
  products = products.where('title LIKE ?', "%#{params[:title]}%") if params[:title]

  # Filtro per prezzo
  products = products.where('price >= ?', params[:minPrice]) if params[:minPrice]
  products = products.where('price <= ?', params[:maxPrice]) if params[:maxPrice]

  # Ordinamento
  products = case params[:sort]
    when 'price_asc' then products.order(price: :asc)
    when 'price_desc' then products.order(price: :desc)
    when 'date_asc' then products.order(created_at: :asc)
    else products.order(created_at: :desc)
  end

  render json: products
end
```

### 5. Wishlist con Sincronizzazione

**Caratteristiche:**
- Wishlist persistente per utenti autenticati
- One-to-one relationship (un utente, una wishlist)
- Aggiunta/rimozione rapida
- Controllo duplicati (composite unique index)
- Move to cart: sposta prodotto da wishlist a carrello

**Funzionalità:**
- Icona cuore (vuoto/pieno) che indica presenza in wishlist
- Badge con conteggio item in header
- Pagina dedicata con lista prodotti
- Bottone "Aggiungi al carrello" direttamente dalla wishlist

### 6. Dashboard Admin con Statistiche

**Funzionalità:**
- Statistiche in tempo reale:
  - Totale revenue
  - Numero ordini
  - Prodotti più venduti
  - Ordini recenti
- CRUD completo prodotti:
  - Creazione con validazione
  - Modifica (prezzo, descrizione, quantità)
  - Eliminazione (con conferma)
  - Adjustment quantità (±N unità)
- Visualizzazione ordini:
  - Lista completa ordini con dettagli
  - Ricerca e filtri
  - Dettaglio ordine con prodotti
  - Eliminazione ordine (con ripristino stock)

**Implementazione Stats:**
```ruby
def stats
  {
    total_revenue: Order.sum(:total),
    orders_count: Order.count,
    products_count: Product.count,
    low_stock_products: Product.where('quantity < ?', 10).count,
    recent_orders: Order.order(created_at: :desc).limit(5),
    top_products: Product
      .joins(:order_items)
      .select('products.*, SUM(order_items.quantity) as total_sold')
      .group('products.id')
      .order('total_sold DESC')
      .limit(5)
  }
end
```

### 7. Guards e Route Protection

**Angular Guards implementati:**

**AuthGuard**: Protegge route che richiedono autenticazione
```typescript
canActivate(): Observable<boolean> {
  return this.authService.isAuthenticated$.pipe(
    tap(isAuth => {
      if (!isAuth) {
        this.router.navigate(['/login'], {
          queryParams: { returnUrl: this.router.url }
        });
      }
    })
  );
}
```

**AdminGuard**: Protegge route admin
```typescript
canActivate(): Observable<boolean> {
  return this.authService.currentUser$.pipe(
    map(user => user?.role === 'admin'),
    tap(isAdmin => {
      if (!isAdmin) {
        this.router.navigate(['/products']);
        this.snackBar.open('Access denied', 'Close');
      }
    })
  );
}
```

**CartGuard**: Verifica carrello non vuoto per checkout
```typescript
canActivate(): Observable<boolean> {
  return this.cartService.getCart().pipe(
    map(cart => cart.items.length > 0),
    tap(hasItems => {
      if (!hasItems) {
        this.router.navigate(['/cart']);
        this.snackBar.open('Cart is empty', 'Close');
      }
    })
  );
}
```

### 8. Error Handling Centralizzato

**Backend (ApplicationController):**
```ruby
rescue_from ActionController::ParameterMissing, with: :handle_parameter_missing
rescue_from ActiveRecord::RecordNotFound, with: :handle_record_not_found
rescue_from ActiveRecord::RecordInvalid, with: :handle_record_invalid
rescue_from StandardError, with: :handle_standard_error

def handle_record_invalid(exception)
  render json: {
    error: exception.record.errors.full_messages.join(', ')
  }, status: :unprocessable_entity
end
```

**Frontend (HTTP Interceptor):**
```typescript
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  return next.handle(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Logout e redirect a login
        this.authService.logout();
        this.router.navigate(['/login']);
      } else if (error.status === 403) {
        // Access denied
        this.snackBar.open('Access denied', 'Close');
      } else if (error.status >= 500) {
        // Server error
        this.snackBar.open('Server error, try again later', 'Close');
      }
      return throwError(() => error);
    })
  );
}
```

### 9. Responsive Design con Angular Material

**Caratteristiche:**
- Material Design components per UI consistente
- Layout responsive con CSS Grid e Flexbox
- Breakpoints per mobile/tablet/desktop
- Snackbar per notifiche utente
- Dialog per conferme (eliminazioni, logout, ecc.)
- Loading indicators per operazioni async

**Components utilizzati:**
- `mat-toolbar` - Header navigazione
- `mat-card` - Product cards
- `mat-form-field`, `mat-input` - Form inputs
- `mat-select` - Dropdown selects
- `mat-paginator` - Paginazione
- `mat-snack-bar` - Notifiche toast
- `mat-icon` - Icone Material

### 10. Validazioni e Constraints Database

**Foreign Keys**: Integrità referenziale garantita
```ruby
add_foreign_key :cart_items, :carts
add_foreign_key :cart_items, :products
add_foreign_key :order_items, :orders
add_foreign_key :order_items, :products
```

**Unique Indexes**: Prevenzione duplicati
```ruby
add_index :users, :email, unique: true
add_index :carts, :user_id, unique: true
add_index :cart_items, [:cart_id, :product_id], unique: true
add_index :order_items, [:order_id, :product_id], unique: true
```

**Validazioni Model**:
```ruby
validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
validates :password, length: { minimum: 6 }
validates :price, numericality: { greater_than_or_equal_to: 0 }
validates :quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
```

## Sistema di Autenticazione

### Architettura JWT

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO DI VITA JWT                        │
└─────────────────────────────────────────────────────────────┘

1. LOGIN/REGISTRATION
   ├─ User invia credenziali
   ├─ Backend valida e crea/trova User
   └─ Backend genera JWT token

2. TOKEN STRUCTURE
   ┌──────────────────────────────────────────┐
   │ HEADER (Base64)                          │
   │ { "alg": "HS256", "typ": "JWT" }         │
   ├──────────────────────────────────────────┤
   │ PAYLOAD (Base64)                         │
   │ {                                        │
   │   "user_id": 123,                        │
   │   "role": "user",                        │
   │   "exp": 1736899200                      │
   │ }                                        │
   ├──────────────────────────────────────────┤
   │ SIGNATURE (HMAC SHA256)                  │
   │ HMACSHA256(                              │
   │   base64UrlEncode(header) + "." +        │
   │   base64UrlEncode(payload),              │
   │   secret_key_base                        │
   │ )                                        │
   └──────────────────────────────────────────┘

3. STORAGE
   ├─ Frontend salva in localStorage
   │  key: 'auth_token'
   │  value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   └─ Include in ogni richiesta autenticata

4. AUTHENTICATED REQUEST
   ├─ Frontend aggiunge header:
   │  Authorization: Bearer <token>
   ├─ Backend estrae e decodifica token
   ├─ Verifica firma e scadenza
   ├─ Estrae user_id dal payload
   └─ Carica @current_user dal database

5. TOKEN EXPIRATION
   ├─ Token scade dopo 24 ore
   ├─ Frontend riceve 401 Unauthorized
   └─ Redirect a /login con returnUrl
```

### Password Security

- **Hashing**: bcrypt con cost factor 12 (2^12 = 4096 iterazioni)
- **Salt**: Generato automaticamente per ogni password
- **Validazione**: Lunghezza minima 6 caratteri
- **Never stored**: Solo hash salvato in `password_digest`

```ruby
# Rails has_secure_password (basato su bcrypt)
class User < ApplicationRecord
  has_secure_password
  validates :password, length: { minimum: 6 }
end

# Internamente:
# - password= setter: genera salt e hash
# - authenticate(password): verifica password
# - password_digest: colonna database con hash
```

## Gestione dello Stato

### Frontend State Management

L'applicazione usa **RxJS Observables** per gestione stato reattivo:

**Patterns utilizzati:**

1. **BehaviorSubject**: Stato con valore iniziale
   ```typescript
   private filters$ = new BehaviorSubject({ title: '', sort: 'dateDesc' });
   ```

2. **combineLatest**: Combinazione di multiple sorgenti
   ```typescript
   paged$ = combineLatest([products$, page$]).pipe(...)
   ```

3. **switchMap**: Cancella richieste precedenti
   ```typescript
   this.filters$.pipe(switchMap(f => this.api.list(f)))
   ```

4. **debounceTime**: Riduce frequenza emissioni
   ```typescript
   this.searchInput$.pipe(debounceTime(300))
   ```

**Services come State Holders:**
- `AuthService`: Stato autenticazione, user corrente
- `CartService`: Stato carrello, conteggio item
- `WishlistService`: Stato wishlist

### Backend State

- **Stateless**: Ogni richiesta è indipendente (JWT)
- **Database**: Unica fonte di verità
- **Caching**: Possibile con `solid_cache` (Rails 8)

## Sicurezza

### Misure Implementate

1. **Authentication & Authorization**
   - JWT tokens con scadenza
   - Password hashing con bcrypt
   - Role-based access control
   - Route guards nel frontend

2. **Input Validation**
   - Validazioni model Rails (lunghezza, formato, unicità)
   - Strong parameters per mass assignment protection
   - Type checking TypeScript nel frontend

3. **SQL Injection Prevention**
   - ActiveRecord ORM con prepared statements
   - Nessuna query SQL raw con input utente

4. **XSS Prevention**
   - Angular sanitizzazione automatica
   - CSP (Content Security Policy) configurabile

5. **CSRF Protection**
   - Tokens JWT stateless (non serve CSRF token)
   - CORS configurato per domini specifici

6. **Error Handling**
   - Messaggi errore generici per utente
   - Log dettagliati solo in development
   - No stack traces in production

7. **Data Integrity**
   - Foreign key constraints
   - Unique indexes
   - Database transactions

### Configurazione CORS

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:4200'  # Frontend development
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      credentials: true
  end
end
```

### Rate Limiting (Implementabile)

Possibile aggiungere rate limiting per API:
- Rack::Attack gem per limitare richieste per IP
- Throttling per endpoint sensibili (login, registration)

---

## Conclusione

Questa architettura fornisce una base solida per un'applicazione e-commerce moderna con:
- Separazione chiara tra frontend e backend
- Autenticazione sicura con JWT
- Gestione completa del ciclo acquisto
- Feature avanzate (wishlist, admin dashboard, inventory management)
- Code quality con validazioni e error handling
- Scalabilità tramite API stateless e componenti riutilizzabili

Il sistema è pronto per essere esteso con funzionalità aggiuntive come:
- Pagamenti integrati (Stripe, PayPal)
- Email notifications (conferma ordine, spedizione)
- Recensioni e ratings prodotti
- Sistema di coupon e sconti
- Multi-currency support
- Advanced analytics e reporting
