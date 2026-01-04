import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth-service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized and user is logged in, token is invalid/expired
      if (error.status === 401 && authService.isLoggedIn()) {
        // Logout user and redirect to login
        authService.logout();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
