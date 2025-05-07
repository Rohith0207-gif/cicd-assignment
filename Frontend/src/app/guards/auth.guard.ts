import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('AuthGuard checking authentication');
  console.log('Current user:', authService.currentUser$);
  console.log('Is authenticated:', authService.isAuthenticated());
  console.log('Required role:', route.data['role']);

  if (!authService.isAuthenticated()) {
    console.log('User not authenticated, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  const requiredRole = route.data['role'];
  if (requiredRole) {
    const isManager = authService.isManager();
    console.log('User is manager:', isManager);
    
    if (requiredRole === 'manager' && !isManager) {
      console.log('Non-manager trying to access manager route, redirecting to dashboard');
      router.navigate(['/dashboard']);
      return false;
    }
    if (requiredRole === 'employee' && isManager) {
      console.log('Manager trying to access employee route, redirecting to manager-dashboard');
      router.navigate(['/manager-dashboard']);
      return false;
    }
  }

  console.log('AuthGuard allowing access');
  return true;
}; 