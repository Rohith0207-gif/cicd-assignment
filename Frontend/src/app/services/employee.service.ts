import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  joinDate: string;
  leaveBalance: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(
      `${this.apiUrl}/employees`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  getEmployeeById(id: string): Observable<Employee> {
    return this.http.get<Employee>(
      `${this.apiUrl}/employees/${id}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  updateEmployee(id: string, employeeData: Partial<Employee>): Observable<Employee> {
    return this.http.patch<Employee>(
      `${this.apiUrl}/employees/${id}`,
      employeeData,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  updateLeaveBalance(id: string, leaveBalance: number): Observable<Employee> {
    return this.http.patch<Employee>(
      `${this.apiUrl}/employees/${id}/leave-balance`,
      { leaveBalance },
      { headers: this.authService.getAuthHeaders() }
    );
  }
} 