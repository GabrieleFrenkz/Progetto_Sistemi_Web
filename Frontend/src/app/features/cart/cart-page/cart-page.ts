import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CartService } from '../../../core/services/cart.service';
import { CartItem } from '../../../core/models/cart';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage implements OnInit {
  protected cartService = inject(CartService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Expose cart service signals to template
  cart = this.cartService.cart;
  loading = this.cartService.loading;
  error = this.cartService.error;
  items = this.cartService.items;
  total = this.cartService.total;
  itemCount = this.cartService.itemCount;
  isEmpty = this.cartService.isEmpty;

  ngOnInit(): void {
    // Reload cart data when page is visited
    this.cartService.loadCart();
  }

  incrementQuantity(item: CartItem): void {
    this.cartService.incrementQuantity(item.id, item.quantity).subscribe({
      next: () => {
        this.showMessage('Quantity updated');
      },
      error: (err) => {
        this.showMessage(err.error?.details?.[0] || 'Failed to update quantity', true);
      }
    });
  }

  decrementQuantity(item: CartItem): void {
    this.cartService.decrementQuantity(item.id, item.quantity).subscribe({
      next: () => {
        this.showMessage(item.quantity === 1 ? 'Item removed' : 'Quantity updated');
      },
      error: () => {
        this.showMessage('Failed to update quantity', true);
      }
    });
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.id).subscribe({
      next: () => {
        this.showMessage('Item removed from cart');
      },
      error: () => {
        this.showMessage('Failed to remove item', true);
      }
    });
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear your entire cart?')) {
      this.cartService.clearCart().subscribe({
        next: () => {
          this.showMessage('Cart cleared');
        },
        error: () => {
          this.showMessage('Failed to clear cart', true);
        }
      });
    }
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  private showMessage(message: string, isError: boolean = false): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: isError ? ['error-snackbar'] : ['success-snackbar']
    });
  }
}
