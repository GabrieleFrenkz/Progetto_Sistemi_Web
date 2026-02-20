# GUIDA DI STUDIO - Progetto E-Commerce

## 📚 Come usare questa guida

Questa guida ti insegnerà:
1. **COME FUNZIONA** ogni componente del progetto
2. **COME MODIFICARE** il codice esistente
3. **COME CREARE** nuove funzionalità da zero
4. **COME ESPORRE** il progetto (cosa dire, cosa mostrare)

---

## 📋 INDICE RAPIDO

1. [Mappa Mentale del Progetto](#1-mappa-mentale-del-progetto)
2. [Backend: Capire e Modificare](#2-backend-capire-e-modificare)
3. [Frontend: Capire e Modificare](#3-frontend-capire-e-modificare)
4. [Come Creare una Nuova Funzionalità](#4-come-creare-una-nuova-funzionalità)
5. [Pattern e Best Practices](#5-pattern-e-best-practices)
6. [Come Esporre il Progetto](#6-come-esporre-il-progetto)
7. [Debugging e Troubleshooting](#7-debugging-e-troubleshooting)

---

## 1. MAPPA MENTALE DEL PROGETTO

### 1.1 Il Flusso Completo (dalla richiesta alla risposta)

```
UTENTE CLICCA "Aggiungi al carrello"
    ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Angular)                                      │
│                                                         │
│ 1. Component (product-card.component.ts)                │
│    → Chiama: cartService.addToCart(productId)          │
│                                                         │
│ 2. Service (cart.service.ts)                            │
│    → HTTP POST /api/cart/items                          │
│    → Body: { product_id: "123", quantity: 1 }          │
│                                                         │
│ 3. AuthInterceptor                                      │
│    → Aggiunge header: Authorization: Bearer <token>    │
│                                                         │
│ 4. HTTP Request inviata al Backend                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Rails)                                         │
│                                                         │
│ 5. Routes (config/routes.rb)                            │
│    → POST /api/cart/items → CartsController#add_item   │
│                                                         │
│ 6. ApplicationController                                │
│    → authenticate_request (decodifica JWT)              │
│    → Carica @current_user dal database                 │
│                                                         │
│ 7. CartsController#add_item                             │
│    → Trova Product (app/models/product.rb)             │
│    → Trova/crea Cart (app/models/cart.rb)              │
│    → Crea CartItem con validazioni                     │
│    → Response JSON: { cart, item, message }            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Riceve Response)                              │
│                                                         │
│ 8. CartService                                          │
│    → .pipe(tap()) aggiorna cartSignal                  │
│    → Notifica tutti i componenti che osservano         │
│                                                         │
│ 9. UI si aggiorna automaticamente                      │
│    → Header badge mostra nuovo count                   │
│    → Snackbar: "Prodotto aggiunto"                     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Dove Trovare Cosa

| Voglio... | Percorso |
|-----------|----------|
| Aggiungere un endpoint API | `Backend/config/routes.rb` + `Backend/app/controllers/api/` |
| Modificare logica database | `Backend/app/models/` |
| Cambiare validazioni | `Backend/app/models/<model>.rb` |
| Aggiungere una pagina | `Frontend/src/app/features/` + `app.routes.ts` |
| Modificare chiamate API | `Frontend/src/app/core/services/` |
| Cambiare autenticazione | `Backend/app/controllers/application_controller.rb` + `Frontend/src/app/core/services/auth-service.ts` |
| Aggiungere un guard | `Frontend/src/app/core/guard/` |
| Gestire errori diversamente | `Frontend/src/app/core/interceptors/error.interceptor.ts` |

---

## 2. BACKEND: CAPIRE E MODIFICARE

### 2.1 Anatomia di un Endpoint API

**Esempio: GET /api/products**

#### Passo 1: Route Definition
**File:** `Backend/config/routes.rb`

```ruby
namespace :api do
  resources :products, only: [:index, :show]
  # Genera:
  # GET /api/products → ProductsController#index
  # GET /api/products/:id → ProductsController#show
end
```

**Come leggere:**
- `namespace :api` → tutti gli URL iniziano con `/api`
- `resources :products` → crea route CRUD standard
- `only: [:index, :show]` → solo queste due azioni (no create/update/delete)

#### Passo 2: Controller Action
**File:** `Backend/app/controllers/api/products_controller.rb`

```ruby
class Api::ProductsController < ApplicationController
  def index
    products = Product.all  # ← Query al database

    # Filtri opzionali
    if params[:title].present?
      products = products.where('title LIKE ?', "%#{params[:title]}%")
    end

    # Ordinamento
    products = products.order(created_at: :desc)

    render json: products  # ← Risposta JSON
  end
end
```

**Come modificare:**
```ruby
# Aggiungi un nuovo filtro per prezzo massimo:
if params[:max_price].present?
  products = products.where('price <= ?', params[:max_price])
end
```

#### Passo 3: Model & Database
**File:** `Backend/app/models/product.rb`

```ruby
class Product < ApplicationRecord
  # Validazioni
  validates :title, presence: true
  validates :price, numericality: { greater_than: 0 }

  # Relazioni
  has_many :cart_items

  # Metodi custom
  def in_stock?
    quantity > 0
  end
end
```

**Schema database:**
```ruby
# In db/schema.rb (generato dalle migrazioni)
create_table "products" do |t|
  t.string "id", primary: true
  t.string "title"
  t.decimal "price", precision: 10, scale: 2
  t.integer "quantity"
  # ...
end
```

### 2.2 Come Aggiungere un Nuovo Endpoint

**Esempio: Voglio aggiungere "Segna prodotto come preferito"**

#### Step 1: Aggiungi la route
**File:** `Backend/config/routes.rb`

```ruby
namespace :api do
  resources :products, only: [:index, :show] do
    member do
      post :favorite  # ← NUOVO: POST /api/products/:id/favorite
    end
  end
end
```

#### Step 2: Aggiungi l'action nel controller
**File:** `Backend/app/controllers/api/products_controller.rb`

```ruby
def favorite
  require_authentication!  # Solo utenti loggati

  @product = Product.find(params[:id])

  # Logica per favorire (esempio semplice)
  current_user.favorite_products << @product

  render json: {
    message: 'Product added to favorites',
    product: @product
  }, status: :ok
rescue ActiveRecord::RecordNotFound
  render json: { error: 'Product not found' }, status: :not_found
end
```

#### Step 3: Test con curl
```bash
curl -X POST http://localhost:3000/api/products/prod-1/favorite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2.3 ApplicationController: Il Cuore dell'Autenticazione

**File:** `Backend/app/controllers/application_controller.rb`

Questo controller è **ereditato da tutti gli altri**. Qui ci sono i metodi condivisi.

#### Metodi Chiave:

**1. `authenticate_request`** - Decodifica JWT
```ruby
def authenticate_request
  header = request.headers['Authorization']  # "Bearer eyJhbG..."
  header = header.split(' ').last if header  # Estrai solo il token

  decoded = JWT.decode(header, Rails.application.secret_key_base, true,
                       { algorithm: 'HS256' })
  @current_user = User.find(decoded[0]['user_id'])
rescue JWT::DecodeError, ActiveRecord::RecordNotFound
  @current_user = nil
end
```

**2. `require_authentication!`** - Protegge endpoint
```ruby
def require_authentication!
  authenticate_request
  render json: { error: 'Not authenticated' }, status: :unauthorized unless current_user
end
```

**Come usarlo nei controller:**
```ruby
class Api::OrdersController < ApplicationController
  before_action :require_authentication!  # ← Tutti i metodi richiedono login

  def index
    # current_user è già disponibile qui
    @orders = current_user.orders
    render json: @orders
  end
end
```

**3. Gestione errori centralizzata**
```ruby
rescue_from ActiveRecord::RecordNotFound, with: :handle_record_not_found

def handle_record_not_found(exception)
  render json: {
    error: 'Not Found',
    message: 'The requested resource was not found'
  }, status: :not_found
end
```

**Beneficio:** Tutti i controller ereditano questa gestione. Se un `Product.find(id)` fallisce, ottieni automaticamente un 404 JSON.

### 2.4 Models: Validazioni e Relazioni

#### Esempio: User Model
**File:** `Backend/app/models/user.rb`

```ruby
class User < ApplicationRecord
  # Password encryption con bcrypt
  has_secure_password

  # Relazioni
  has_many :orders, dependent: :nullify  # ← Se cancello user, orders rimangono ma user_id = null
  has_one :cart, dependent: :destroy     # ← Se cancello user, cancella anche cart
  has_one :wishlist, dependent: :destroy

  # Validazioni
  validates :email,
            presence: true,           # ← Non può essere vuoto
            uniqueness: true,         # ← Deve essere unico
            format: { with: URI::MailTo::EMAIL_REGEXP }  # ← Formato email valido

  validates :password,
            length: { minimum: 6 },   # ← Almeno 6 caratteri
            if: :password_digest_changed?  # ← Solo se password cambiata

  # Metodi custom
  def admin?
    role == 'admin'
  end

  def full_name
    "#{first_name} #{last_name}"
  end
end
```

#### Come Aggiungere una Nuova Validazione

**Esempio: Email deve essere di un dominio specifico**

```ruby
validates :email, format: {
  with: /@example\.com\z/,
  message: "must be from example.com domain"
}
```

#### Relazioni Database Spiegate

```ruby
# User has_many Orders
class User
  has_many :orders  # ← User può avere molti ordini
end

# Order belongs_to User
class Order
  belongs_to :user, optional: true  # ← Ogni ordine appartiene a un user (opzionale per guest)
end

# Utilizzo:
user = User.find(1)
user.orders  # ← Restituisce array di Order
user.orders.create(total: 100)  # ← Crea nuovo ordine per questo user

order = Order.find(1)
order.user  # ← Restituisce il User proprietario
```

#### Many-to-Many con Join Table

```ruby
# Cart has_many Products THROUGH CartItems
class Cart
  has_many :cart_items
  has_many :products, through: :cart_items
end

class CartItem  # ← Join table
  belongs_to :cart
  belongs_to :product
end

# Utilizzo:
cart = Cart.find(1)
cart.products  # ← Array di Product nel carrello
cart.cart_items  # ← Array di CartItem (include quantity, unit_price)
```

### 2.5 Migrations: Modificare il Database

**File:** `Backend/db/migrate/YYYYMMDDHHMMSS_create_products.rb`

```ruby
class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products, id: :string do |t|  # ← id è string invece di integer
      t.string :title, null: false  # ← NOT NULL nel database
      t.text :description
      t.decimal :price, precision: 10, scale: 2  # ← 10 cifre totali, 2 decimali
      t.integer :quantity, default: 0

      t.timestamps  # ← Aggiunge created_at e updated_at
    end

    add_index :products, :title  # ← Indice per ricerca veloce
  end
end
```

#### Come Aggiungere una Colonna

```bash
# Genera migrazione
rails generate migration AddRatingToProducts rating:decimal

# Risulta in:
class AddRatingToProducts < ActiveRecord::Migration[8.1]
  def change
    add_column :products, :rating, :decimal, precision: 3, scale: 2, default: 0.0
  end
end

# Esegui migrazione
rails db:migrate
```

#### Come Modificare una Colonna Esistente

```ruby
class ChangeProductQuantityDefault < ActiveRecord::Migration[8.1]
  def change
    change_column_default :products, :quantity, from: 0, to: 10
  end
end
```

---

## 3. FRONTEND: CAPIRE E MODIFICARE

### 3.1 Anatomia di una Pagina (Component)

**Esempio: Product List Page**

#### File Structure:
```
features/products/product-page/
├── product-page.ts        ← Logica TypeScript
├── product-page.html      ← Template HTML
└── product-page.scss      ← Stili CSS
```

#### product-page.ts (Component)
```typescript
import { Component, OnInit, signal, computed } from '@angular/core';
import { ProductApi } from '../../../core/services/product-api';
import { Product } from '../../../core/models/product';

@Component({
  selector: 'app-product-page',
  standalone: true,
  templateUrl: './product-page.html',
  styleUrls: ['./product-page.scss']
})
export class ProductPage implements OnInit {
  // Signals per stato reattivo
  protected products = signal<Product[]>([]);
  protected loading = signal<boolean>(false);
  protected error = signal<string | null>(null);

  // Computed signal (valore derivato)
  protected productCount = computed(() => this.products().length);

  constructor(private productApi: ProductApi) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading.set(true);

    this.productApi.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load products');
        this.loading.set(false);
      }
    });
  }
}
```

#### product-page.html (Template)
```html
<div class="product-page">
  <h1>Products ({{ productCount() }})</h1>

  <!-- Loading state -->
  @if (loading()) {
    <mat-spinner></mat-spinner>
  }

  <!-- Error state -->
  @if (error()) {
    <div class="error">{{ error() }}</div>
  }

  <!-- Products grid -->
  <div class="products-grid">
    @for (product of products(); track product.id) {
      <app-product-card [product]="product"></app-product-card>
    }
    @empty {
      <p>No products found</p>
    }
  </div>
</div>
```

**Sintassi Angular 17+:**
- `@if (condition) { }` invece di `*ngIf`
- `@for (item of items; track item.id) { }` invece di `*ngFor`
- `{{ value() }}` per leggere signal (con parentesi!)

### 3.2 Services: Gestione Stato e API

**File:** `Frontend/src/app/core/services/cart.service.ts`

```typescript
@Injectable({ providedIn: 'root' })  // ← Singleton globale
export class CartService {
  private readonly baseUrl = 'http://localhost:3000/api';

  // SIGNALS per stato reattivo
  private cartSignal = signal<Cart | null>(null);
  private loadingSignal = signal<boolean>(false);

  // Signals pubblici readonly
  cart = this.cartSignal.asReadonly();
  loading = this.loadingSignal.asReadonly();

  // COMPUTED signals (valori derivati)
  itemCount = computed(() => this.cartSignal()?.itemCount ?? 0);
  total = computed(() => this.cartSignal()?.total ?? 0);
  isEmpty = computed(() => (this.cartSignal()?.items?.length ?? 0) === 0);

  constructor(private http: HttpClient) {}

  // Metodi pubblici per modificare lo stato
  addToCart(productId: string, quantity: number = 1): Observable<any> {
    this.loadingSignal.set(true);

    return this.http.post(`${this.baseUrl}/cart/items`, {
      product_id: productId,
      quantity
    }).pipe(
      tap(response => {
        this.cartSignal.set(response.cart);  // ← Aggiorna signal
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }
}
```

**Pattern Signal:**
- `signal()` crea uno stato mutabile
- `.asReadonly()` permette solo lettura dall'esterno
- `computed()` crea valori derivati (aggiornati automaticamente)
- Nei template: `{{ itemCount() }}` con parentesi

**Pattern Observable:**
- `.pipe()` per concatenare operatori
- `tap()` per side effects (aggiornare signal)
- `catchError()` per gestire errori
- `.subscribe()` per eseguire

### 3.3 Routing e Guards

#### app.routes.ts
```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },

  // Route pubblica
  { path: 'products', loadComponent: () => import('...') },

  // Route protetta (solo autenticati)
  {
    path: 'cart',
    loadComponent: () => import('...'),
    canActivate: [authGuard]  // ← Controlla se loggato
  },

  // Route admin (solo admin)
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [adminGuard]  // ← Controlla se admin
  }
];
```

#### authGuard (Functional Guard)
**File:** `Frontend/src/app/core/guard/auth.guard.ts`

```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
```

#### adminGuard
```typescript
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (!auth.isAdmin()) {
    router.navigate(['/products']);
    return false;
  }

  return true;
};
```

**Come funziona:**
1. User tenta di navigare a `/admin`
2. Angular esegue `adminGuard`
3. Guard verifica autenticazione e ruolo
4. Se fail → redirect automatico
5. Se pass → mostra componente

### 3.4 Interceptors: Middleware HTTP

#### AuthInterceptor
**File:** `Frontend/src/app/core/interceptors/auth.interceptor.ts`

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Aggiunge token a TUTTE le richieste HTTP
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};
```

**Effetto:**
```typescript
// Tu scrivi:
this.http.get('/api/cart')

// AuthInterceptor trasforma in:
this.http.get('/api/cart', {
  headers: { Authorization: 'Bearer eyJhbG...' }
})
```

#### ErrorInterceptor
**File:** `Frontend/src/app/core/interceptors/error.interceptor.ts`

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Si è verificato un errore';

      switch (error.status) {
        case 401:  // Unauthorized
          message = 'Sessione scaduta';
          authService.logout();
          router.navigate(['/login']);
          break;

        case 403:  // Forbidden
          message = 'Non hai i permessi';
          break;

        case 404:  // Not Found
          message = error.error?.error || 'Risorsa non trovata';
          break;

        case 422:  // Validation Error
          message = error.error?.error || 'Dati non validi';
          break;

        case 500:  // Server Error
          message = 'Errore del server';
          break;
      }

      if (error.status !== 401) {
        notificationService.showError(message);
      }

      return throwError(() => error);
    })
  );
};
```

**Effetto:** Ogni errore HTTP viene gestito centralmente, senza duplicare codice nei componenti.

### 3.5 Models/Interfaces TypeScript

**File:** `Frontend/src/app/core/models/product.ts`

```typescript
export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  sale: boolean;
  thumbnail?: string;  // ← Opzionale
  tags?: string[];
  quantity?: number;
  inStock?: boolean;
  createdAt: string;
}
```

**Utilizzo:**
```typescript
// Nel service
getProduct(id: string): Observable<Product> {
  return this.http.get<Product>(`/api/products/${id}`);
  //                    ↑ Type safety
}

// Nel component
product = signal<Product | null>(null);

// TypeScript sa che product ha .title, .price, ecc.
```

**CamelCase vs snake_case:**
- **Backend Rails:** `product_id`, `first_name` (snake_case)
- **Frontend Angular:** `productId`, `firstName` (camelCase)
- Conversione automatica tramite serializzatori Rails

---

## 4. COME CREARE UNA NUOVA FUNZIONALITÀ

### Esempio: Sistema di Recensioni Prodotti

#### 4.1 BACKEND

**Step 1: Crea il Model Review**

```bash
cd Backend
rails generate model Review product_id:string user_id:integer rating:integer comment:text
rails db:migrate
```

**Step 2: Aggiungi relazioni**
**File:** `Backend/app/models/review.rb`

```ruby
class Review < ApplicationRecord
  belongs_to :product, foreign_key: 'product_id', primary_key: 'id'
  belongs_to :user

  validates :rating, presence: true, inclusion: { in: 1..5 }
  validates :comment, presence: true, length: { minimum: 10 }
end
```

**File:** `Backend/app/models/product.rb`

```ruby
class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy

  # Calcola rating medio
  def average_rating
    reviews.average(:rating)&.round(1) || 0
  end
end
```

**Step 3: Crea Controller**
**File:** `Backend/app/controllers/api/reviews_controller.rb`

```ruby
class Api::ReviewsController < ApplicationController
  before_action :require_authentication!, only: [:create, :destroy]

  # GET /api/products/:product_id/reviews
  def index
    product = Product.find(params[:product_id])
    reviews = product.reviews.includes(:user).order(created_at: :desc)
    render json: reviews
  end

  # POST /api/products/:product_id/reviews
  def create
    product = Product.find(params[:product_id])

    review = product.reviews.build(review_params)
    review.user = current_user

    if review.save
      render json: review, status: :created
    else
      render json: { error: review.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/reviews/:id
  def destroy
    review = Review.find(params[:id])

    # Solo l'autore può cancellare
    if review.user == current_user || current_user.admin?
      review.destroy
      render json: { message: 'Review deleted' }
    else
      render json: { error: 'Unauthorized' }, status: :forbidden
    end
  end

  private

  def review_params
    params.require(:review).permit(:rating, :comment)
  end
end
```

**Step 4: Aggiungi Routes**
**File:** `Backend/config/routes.rb`

```ruby
namespace :api do
  resources :products, only: [:index, :show] do
    resources :reviews, only: [:index, :create]  # ← Nested routes
  end

  resources :reviews, only: [:destroy]
end
```

**Genera:**
- `GET /api/products/:product_id/reviews`
- `POST /api/products/:product_id/reviews`
- `DELETE /api/reviews/:id`

#### 4.2 FRONTEND

**Step 1: Crea Model**
**File:** `Frontend/src/app/core/models/review.ts`

```typescript
import { User } from './user';

export interface Review {
  id: number;
  productId: string;
  userId: number;
  rating: number;
  comment: string;
  createdAt: string;
  user?: User;
}

export interface CreateReviewRequest {
  rating: number;
  comment: string;
}
```

**Step 2: Crea Service**
**File:** `Frontend/src/app/core/services/review.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Review, CreateReviewRequest } from '../models/review';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly baseUrl = 'http://localhost:3000/api';

  private reviewsSignal = signal<Review[]>([]);
  reviews = this.reviewsSignal.asReadonly();

  constructor(private http: HttpClient) {}

  getReviews(productId: string): Observable<Review[]> {
    return this.http.get<Review[]>(
      `${this.baseUrl}/products/${productId}/reviews`
    ).pipe(
      tap(reviews => this.reviewsSignal.set(reviews))
    );
  }

  createReview(productId: string, review: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(
      `${this.baseUrl}/products/${productId}/reviews`,
      { review }
    ).pipe(
      tap(newReview => {
        // Aggiungi alla lista locale
        const current = this.reviewsSignal();
        this.reviewsSignal.set([newReview, ...current]);
      })
    );
  }

  deleteReview(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/reviews/${id}`).pipe(
      tap(() => {
        // Rimuovi dalla lista locale
        const current = this.reviewsSignal();
        this.reviewsSignal.set(current.filter(r => r.id !== id));
      })
    );
  }
}
```

**Step 3: Crea Component**
**File:** `Frontend/src/app/features/products/product-reviews/product-reviews.component.ts`

```typescript
import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReviewService } from '../../../core/services/review.service';
import { AuthService } from '../../../core/services/auth-service';
import { Review } from '../../../core/models/review';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  templateUrl: './product-reviews.component.html'
})
export class ProductReviewsComponent implements OnInit {
  @Input({ required: true }) productId!: string;

  protected reviews = this.reviewService.reviews;
  protected loading = signal(false);
  protected reviewForm: FormGroup;

  constructor(
    private reviewService: ReviewService,
    protected authService: AuthService,
    private fb: FormBuilder
  ) {
    this.reviewForm = this.fb.group({
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    this.loadReviews();
  }

  loadReviews() {
    this.loading.set(true);
    this.reviewService.getReviews(this.productId).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });
  }

  submitReview() {
    if (this.reviewForm.invalid) return;

    this.loading.set(true);
    this.reviewService.createReview(
      this.productId,
      this.reviewForm.value
    ).subscribe({
      next: () => {
        this.reviewForm.reset({ rating: 5, comment: '' });
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  deleteReview(id: number) {
    if (!confirm('Delete this review?')) return;

    this.reviewService.deleteReview(id).subscribe();
  }
}
```

**Step 4: Template**
**File:** `product-reviews.component.html`

```html
<div class="reviews-section">
  <h2>Customer Reviews</h2>

  <!-- Form per nuova recensione (solo se loggato) -->
  @if (authService.isLoggedIn()) {
    <form [formGroup]="reviewForm" (ngSubmit)="submitReview()">
      <mat-form-field>
        <mat-label>Rating</mat-label>
        <mat-select formControlName="rating">
          <mat-option [value]="1">1 Star</mat-option>
          <mat-option [value]="2">2 Stars</mat-option>
          <mat-option [value]="3">3 Stars</mat-option>
          <mat-option [value]="4">4 Stars</mat-option>
          <mat-option [value]="5">5 Stars</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field>
        <mat-label>Comment</mat-label>
        <textarea matInput formControlName="comment" rows="4"></textarea>
      </mat-form-field>

      <button mat-raised-button color="primary" type="submit"
              [disabled]="reviewForm.invalid || loading()">
        Submit Review
      </button>
    </form>
  }

  <!-- Lista recensioni -->
  @if (loading()) {
    <mat-spinner></mat-spinner>
  }

  @for (review of reviews(); track review.id) {
    <div class="review-card">
      <div class="review-header">
        <span class="author">{{ review.user?.firstName }} {{ review.user?.lastName }}</span>
        <span class="rating">{{ '★'.repeat(review.rating) }}</span>
      </div>
      <p class="comment">{{ review.comment }}</p>
      <span class="date">{{ review.createdAt | date }}</span>

      @if (authService.currentUser()?.id === review.userId || authService.isAdmin()) {
        <button mat-icon-button (click)="deleteReview(review.id)">
          <mat-icon>delete</mat-icon>
        </button>
      }
    </div>
  }
  @empty {
    <p>No reviews yet. Be the first!</p>
  }
</div>
```

**Step 5: Aggiungi al Product Detail**
**File:** `product-detail-page.html`

```html
<div class="product-detail">
  <!-- Dettagli prodotto... -->

  <!-- Recensioni -->
  <app-product-reviews [productId]="product().id"></app-product-reviews>
</div>
```

---

## 5. PATTERN E BEST PRACTICES

### 5.1 Pattern Backend (Rails)

#### Strong Parameters
```ruby
# SEMPRE usa strong parameters per sicurezza
def create
  product = Product.new(product_params)  # ← Filtra parametri consentiti
  # ...
end

private

def product_params
  params.require(:product).permit(:title, :price, :description)
  # NON permette params[:admin] o params[:verified]
end
```

#### Service Objects per Logica Complessa
```ruby
# Invece di mettere tutto nel controller:
class OrderCheckoutService
  def initialize(user, cart)
    @user = user
    @cart = cart
  end

  def call
    ActiveRecord::Base.transaction do
      order = create_order
      update_inventory
      clear_cart
      send_confirmation_email
      order
    end
  end

  private

  def create_order
    # ...
  end
end

# Nel controller:
def checkout
  service = OrderCheckoutService.new(current_user, current_cart)
  order = service.call
  render json: order
end
```

#### Scopes per Query Riutilizzabili
```ruby
class Product < ApplicationRecord
  scope :in_stock, -> { where('quantity > 0') }
  scope :on_sale, -> { where(sale: true) }
  scope :recent, -> { order(created_at: :desc).limit(10) }
end

# Utilizzo:
Product.in_stock.on_sale
Product.recent
```

### 5.2 Pattern Frontend (Angular)

#### Signals per Stato Reattivo
```typescript
// ✅ CORRETTO: Usa signals
protected products = signal<Product[]>([]);
protected loading = signal(false);

// Nel template:
{{ products().length }}  // ← Con parentesi

// Aggiorna:
this.products.set(newProducts);
this.products.update(prev => [...prev, newProduct]);
```

#### Computed per Valori Derivati
```typescript
// Automaticamente ricalcolati quando dipendenze cambiano
protected total = computed(() =>
  this.items().reduce((sum, item) => sum + item.price, 0)
);

protected hasDiscount = computed(() =>
  this.product()?.sale === true
);
```

#### Unsubscribe Automatico
```typescript
// ✅ CORRETTO: Con async pipe (auto-unsubscribe)
products$ = this.productApi.list();

// Nel template:
@for (product of products$ | async; track product.id) { }

// ✅ CORRETTO: Con signals + subscribe in ngOnInit
ngOnInit() {
  this.productApi.list().subscribe(data =>
    this.products.set(data)
  );
}
// Angular pulisce automaticamente
```

#### Error Handling nei Components
```typescript
// ❌ EVITA: Error handling duplicato
this.http.get(...).subscribe({
  error: (err) => {
    if (err.status === 401) { /* ... */ }
    if (err.status === 404) { /* ... */ }
  }
});

// ✅ CORRETTO: Lascia a ErrorInterceptor
this.http.get(...).subscribe({
  next: (data) => this.handleData(data),
  // Errori gestiti centralmente
});
```

---

## 6. COME ESPORRE IL PROGETTO

### 6.1 Presentazione Tecnica (5 minuti)

**Apertura:**
"Ho sviluppato un'applicazione e-commerce full-stack che implementa un sistema completo di vendita online con carrello, wishlist e pannello amministrativo."

**Dimostrazione Live:**

1. **Homepage Prodotti** (30 sec)
   - "Qui vediamo il catalogo con ricerca e filtri in tempo reale"
   - Mostra: Ricerca, filtro prezzo, ordinamento

2. **Dettaglio Prodotto** (20 sec)
   - "Ogni prodotto ha dettagli completi e gestione scorte"
   - Mostra: Badge "In offerta", "Esaurito"

3. **Carrello** (45 sec)
   - "Il carrello supporta utenti guest e autenticati"
   - Mostra: Aggiungi prodotto → Vai al carrello
   - "Modifico la quantità, il totale si aggiorna automaticamente"

4. **Checkout e Ordine** (60 sec)
   - "Processo di checkout con validazione dati"
   - Completa ordine → "L'inventario viene decrementato automaticamente"
   - Mostra storico ordini

5. **Pannello Admin** (90 sec)
   - "Dashboard amministrativo con statistiche"
   - Mostra: Totale vendite, prodotti più venduti
   - "Posso creare, modificare ed eliminare prodotti"
   - "Gestisco l'inventario e visualizzo tutti gli ordini"

6. **Sicurezza e Autenticazione** (45 sec)
   - Logout → Prova accedere a /admin
   - "Le route sono protette con guards"
   - Login come admin → Accesso consentito

### 6.2 Punti di Forza da Evidenziare

**Architettura:**
- "Backend Rails API-only completamente stateless"
- "Frontend Angular con lazy loading per performance ottimali"
- "Autenticazione JWT sicura con token expiration"

**Gestione Stato:**
- "Angular Signals per reattività moderna e type-safe"
- "State management centralizzato nei services"

**Sicurezza:**
- "Password hashate con bcrypt"
- "Validazioni su frontend E backend"
- "Error handling centralizzato"
- "CORS configurato, protection contro SQL injection e XSS"

**Business Logic:**
- "Gestione inventario in tempo reale con transazioni atomiche"
- "Merge automatico carrello guest → utente loggato"
- "Ripristino stock automatico quando un ordine viene cancellato"

### 6.3 Domande Frequenti e Risposte

**Q: Come gestisci la scalabilità?**
A: "Backend stateless permette horizontal scaling. Il database SQLite è per dev, in produzione userei PostgreSQL. La separazione frontend/backend permette di deployare e scalare indipendentemente."

**Q: Come previeni race conditions nell'inventario?**
A: "Uso transazioni database atomiche. Quando creo un ordine, il decremento dello stock avviene nella stessa transazione. Se fallisce, rollback automatico."

**Q: Perché JWT invece di sessioni?**
A: "JWT permette stateless backend, facilita scaling orizzontale, supporta SPA meglio delle session cookies, e permette autenticazione cross-domain."

**Q: Come gestisci gli errori?**
A: "Error handling centralizzato su entrambi i lati: ApplicationController per Rails cattura tutti gli errori e restituisce JSON strutturato. ErrorInterceptor in Angular gestisce tutti gli HTTP error e mostra notifiche user-friendly."

**Q: Perché Signals invece di RxJS BehaviorSubject?**
A: "Signals sono il futuro di Angular: type-safe, performance migliori, syntax più pulita. Computed signals prevengono calcoli non necessari. Ma uso ancora RxJS per operazioni HTTP asincrone."

### 6.4 Estensioni Possibili

**Per impressionare:**

"Il sistema è progettato per essere esteso facilmente. Ad esempio, potrei aggiungere:"

1. **Payment Integration**
   - "Stripe o PayPal per pagamenti reali"
   - "Basterebbe un PaymentsController e integrare Stripe SDK"

2. **Email Notifications**
   - "ActionMailer per conferme ordine"
   - "Template email responsive con dettagli ordine"

3. **Review System**
   - "Un Model Review con relazione many-to-many Product-User"
   - "Rating aggregation con database query"

4. **Real-time Inventory**
   - "Action Cable (WebSocket) per notificare quando un prodotto torna disponibile"

5. **Advanced Search**
   - "Elasticsearch integration per full-text search"
   - "Autocomplete con debouncing"

---

## 7. DEBUGGING E TROUBLESHOOTING

### 7.1 Backend Debugging

#### Rails Console
```bash
cd Backend
rails console

# Testa queries:
User.find(1)
Product.in_stock.count
Order.includes(:order_items).first

# Testa metodi:
user = User.first
user.admin?
user.cart.total

# Debug JWT:
payload = { user_id: 1, role: 'admin', exp: 24.hours.from_now.to_i }
token = JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
JWT.decode(token, Rails.application.secret_key_base, true, { algorithm: 'HS256' })
```

#### Log Watching
```bash
tail -f Backend/log/development.log

# Vedi SQL queries, parametri, errori
```

#### Common Errors

**1. "Couldn't find Product with 'id'=..."**
```ruby
# Causa: ID non esiste
# Fix: Aggiungi rescue
def show
  @product = Product.find(params[:id])
rescue ActiveRecord::RecordNotFound
  render json: { error: 'Product not found' }, status: :not_found
end
```

**2. "Validation failed: Email has already been taken"**
```ruby
# Causa: Email duplicata
# Fix: Gestisci errore o usa find_or_create_by
User.find_or_create_by(email: params[:email]) do |user|
  user.password = params[:password]
end
```

**3. "CORS policy: No 'Access-Control-Allow-Origin' header"**
```ruby
# Fix: Verifica config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:4200"
    resource "*", headers: :any, methods: [:get, :post, :patch, :delete]
  end
end
```

### 7.2 Frontend Debugging

#### Browser DevTools

**Console:**
```typescript
// Nel component, logga signals:
console.log('Products:', this.products());
console.log('Loading:', this.loading());

// Nel service, logga HTTP:
this.http.get(...).pipe(
  tap(response => console.log('Response:', response))
)
```

**Network Tab:**
- Verifica request/response
- Controlla headers (Authorization presente?)
- Controlla status code (200, 401, 404, ...)

**Application Tab:**
- localStorage → Verifica `auth_token` presente
- Copia token → jwt.io per decodificare

#### Common Errors

**1. "Cannot read property of undefined"**
```typescript
// ❌ Causa:
{{ product.title }}  // product è undefined

// ✅ Fix: Optional chaining
{{ product?.title }}

// O verifica prima:
@if (product()) {
  {{ product()!.title }}
}
```

**2. "Signal is not a function"**
```typescript
// ❌ Sbagliato:
{{ products }}  // Senza ()

// ✅ Corretto:
{{ products() }}
```

**3. "HTTP 401 Unauthorized"**
```typescript
// Verifica:
1. Token presente in localStorage?
2. Token scaduto? (decodifica su jwt.io)
3. AuthInterceptor configurato in app.config.ts?

// Fix:
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    )
  ]
};
```

**4. "Route guard infinite loop"**
```typescript
// ❌ Causa: Guard redirect a se stesso
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  router.navigate(['/login']);  // ← Se guard è su /login!
  return false;
};

// ✅ Fix: Verifica routing
```

### 7.3 Integration Debugging

#### Backend + Frontend Communication

**Test Backend Isolato:**
```bash
# Con curl:
curl http://localhost:3000/api/products

# Con token:
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/cart
```

**Test Frontend Isolato:**
```typescript
// Hardcode response per testare UI:
getProducts(): Observable<Product[]> {
  return of([
    { id: '1', title: 'Test', price: 10, /* ... */ }
  ]);
}
```

**Verifica CORS:**
```javascript
// In browser console:
fetch('http://localhost:3000/api/products')
  .then(r => r.json())
  .then(data => console.log(data));

// Se CORS error → verifica cors.rb
```

---

## 8. CHEAT SHEET COMANDI

### Backend (Rails)

```bash
# Avvia server
cd Backend
rails server

# Console interattiva
rails console

# Database
rails db:create          # Crea database
rails db:migrate         # Esegui migrazioni
rails db:seed            # Popola con dati iniziali
rails db:reset           # Drop + create + migrate + seed

# Genera codice
rails generate model Review user:references product:references
rails generate controller Api::Reviews
rails generate migration AddRatingToProducts rating:decimal

# Test
bundle exec rspec                    # Tutti i test
bundle exec rspec spec/models/       # Solo model tests

# Gems
bundle install           # Installa dipendenze
```

### Frontend (Angular)

```bash
# Avvia server
cd Frontend
npm start                # ng serve

# Genera codice
ng generate component features/reviews/review-list
ng generate service core/services/review
ng generate guard core/guards/owner
ng generate interface core/models/review

# Build production
ng build --configuration production

# Test
npm test                 # Vitest
npm run test:watch       # Watch mode

# Dependencies
npm install              # Installa dipendenze
npm install @angular/material  # Aggiungi libreria
```

---

## 9. RISORSE UTILI

### Documentazione Ufficiale

- **Rails:** https://guides.rubyonrails.org/
- **Angular:** https://angular.dev/
- **Angular Material:** https://material.angular.io/
- **RxJS:** https://rxjs.dev/

### Tools

- **JWT Decoder:** https://jwt.io/
- **JSON Formatter:** Chrome extension
- **Postman:** Testing API REST
- **DB Browser for SQLite:** Visualizza database

---

## 10. CONCLUSIONE

**Hai imparato:**

✅ Come funziona l'architettura completa (Backend ↔ Frontend)
✅ Come modificare endpoint API e models
✅ Come creare componenti e services Angular
✅ Come aggiungere una nuova funzionalità end-to-end
✅ Best practices e pattern moderni
✅ Come presentare e difendere il progetto

**Prossimi Passi:**

1. Sperimenta modificando un endpoint esistente
2. Aggiungi una piccola feature (es. "Ordina per rating")
3. Pratica spiegando il flusso a voce alta
4. Deploy su un servizio (Render, Heroku, Vercel)

**Buono studio! 🚀**
