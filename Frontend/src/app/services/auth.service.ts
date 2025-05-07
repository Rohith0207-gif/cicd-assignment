import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';

interface UserInfo {
  uid: string;
  email: string;
  role: string;
  id_token: string;
}

export interface LoginResponse {
  message: string;
  user: {
    uid: string;
    email: string;
    role: string;
  };
  id_token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserInfo | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient, 
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    console.log('AuthService initialized');
    this.loadStoredUser();
  }

  private loadStoredUser() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const storedUser = localStorage.getItem('userInfo');
        console.log('Loading stored user from localStorage:', storedUser);
        
        if (storedUser) {
          const userInfo = JSON.parse(storedUser);
          console.log('Parsed user info from storage:', userInfo);
          
          if (userInfo && userInfo.email && userInfo.id_token) {
            this.currentUserSubject.next(userInfo);
            console.log('User loaded from storage:', this.currentUserSubject.value);
          } else {
            console.log('Invalid user data in storage, clearing...');
            localStorage.removeItem('userInfo');
          }
        } else {
          console.log('No user data found in storage');
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
        localStorage.removeItem('userInfo');
      }
    }
  }

  getAuthHeaders(): { [key: string]: string } {
    const userInfo = this.currentUserSubject.value;
    const token = userInfo?.id_token || localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found');
      return { 'Content-Type': 'application/json' };
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async signUp(email: string, password: string, role: string): Promise<void> {
    try {
      const response: any = await this.http.post(`${this.apiUrl}/signup`, {
        email,
        password,
        role
      }).toPromise();
      if (response && response.token) {
        const userInfo: UserInfo = {
          uid: response.uid || response.id || '',
          email: response.email,
          role: response.role || 'employee',
          id_token: response.token
        };

        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('userInfo', JSON.stringify(userInfo));
          console.log('User info stored in localStorage');
        }
        this.currentUserSubject.next(userInfo);
        this.router.navigate(['/dashboard']);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      throw new Error(error.error?.detail || 'Error during signup');
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      const response: any = await this.http.post(`${this.apiUrl}/signin`, {
        email,
        password
      }).toPromise();

      if (!response || !response.token) {
        throw new Error('Invalid response from server');
      }

      const userInfo: UserInfo = {
        uid: response.uid || response.id || '',
        email: response.email,
        role: response.role || 'employee',
        id_token: response.token
      };

      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        console.log('User info stored in localStorage');
      }
      this.currentUserSubject.next(userInfo);
      console.log('Current user updated:', this.currentUserSubject.value);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('SignIn Error:', error);
      throw new Error(error.error?.detail || 'Invalid email or password');
    }
  }

  async logout(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('userInfo');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value?.id_token;
  }

  isManager(): boolean {
    const user = this.currentUserSubject.value;
    console.log('Checking manager status - Full user:', user);
    console.log('Checking manager status - Role:', user?.role);
    console.log('Checking manager status - Storage:', localStorage.getItem('userInfo'));
    return user?.role?.toLowerCase() === 'manager';
  }

  login(email: string, password: string): Observable<LoginResponse> {
    console.log('Starting login process for:', email);
    return this.http.post<LoginResponse>(`${this.apiUrl}/signin`, { email, password })
      .pipe(
        tap(response => {
          console.log('Raw login response:', response);
          
          if (response.id_token && response.user) {
            console.log('Token and user info found, creating user info');
            const userInfo: UserInfo = {
              uid: response.user.uid,
              email: response.user.email,
              role: response.user.role,
              id_token: response.id_token
            };
            
            if (isPlatformBrowser(this.platformId)) {
              console.log('Storing user info in localStorage:', userInfo);
              localStorage.setItem('userInfo', JSON.stringify(userInfo));
            }
            
            console.log('Updating current user subject');
            this.currentUserSubject.next(userInfo);
            console.log('Current user after update:', this.currentUserSubject.value);
            
            console.log('Navigating based on role:', userInfo.role);
            const targetRoute = userInfo.role === 'manager' ? '/manager-dashboard' : '/dashboard';
            this.router.navigate([targetRoute]).then(success => {
              console.log(`Navigation to ${targetRoute}:`, success ? 'successful' : 'failed');
            }).catch(error => {
              console.error('Navigation error:', error);
            });
          } else {
            console.warn('Invalid response structure:', response);
            throw new Error('Invalid response: Missing token or user info');
          }
        })
      );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
}
