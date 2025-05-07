import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Department {
  id: string;
  name: string;
  description: string;
  managerId: string;
  employeeCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(
      `${this.apiUrl}/departments`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  getDepartmentById(id: string): Observable<Department> {
    return this.http.get<Department>(
      `${this.apiUrl}/departments/${id}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  createDepartment(department: Omit<Department, 'id' | 'employeeCount'>): Observable<Department> {
    return this.http.post<Department>(
      `${this.apiUrl}/departments`,
      department,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  updateDepartment(id: string, departmentData: Partial<Department>): Observable<Department> {
    return this.http.patch<Department>(
      `${this.apiUrl}/departments/${id}`,
      departmentData,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/departments/${id}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }
} 