import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LeaveRequest {
  id?: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveResponse {
  leave_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface ApiResponse {
  leaves: LeaveResponse[];
}

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  private handleError = (error: HttpErrorResponse) => {
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      error: error.error,
      url: error.url
    });
    
    let errorMessage = 'An error occurred while processing your request';
    
    if (error.status === 0) {
      errorMessage = 'Unable to connect to the server. Please check your internet connection.';
    } else if (error.status === 401) {
      this.authService.logout();
      this.router.navigate(['/login']);
      errorMessage = 'Your session has expired. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource was not found.';
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error) {
      if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error.detail) {
        errorMessage = error.error.detail;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  private convertResponseToRequest(response: LeaveResponse): LeaveRequest {
    return {
      id: response?.leave_id,
      employeeId: response?.employee_id,
      startDate: response?.start_date,
      endDate: response?.end_date,
      type: response?.leave_type,
      reason: response?.reason,
      status: this.normalizeStatus(response?.status),
      createdAt: response?.created_at,
      updatedAt: response?.updated_at
    };
  }

  createLeaveRequest(leaveRequest: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Observable<LeaveRequest> {
    const headers = this.authService.getAuthHeaders();
    const requestData = {
      employee_id: leaveRequest.employeeId,
      start_date: leaveRequest.startDate,
      end_date: leaveRequest.endDate,
      leave_type: leaveRequest.type,
      reason: leaveRequest.reason
    };
    
    return this.http.post<any>(`${this.apiUrl}/leave`, requestData, { headers })
      .pipe(
        map(response => {
          // Convert the nested response to the expected format
          const leaveResponse: LeaveResponse = {
            leave_id: response.leave_id,
            employee_id: leaveRequest.employeeId,
            start_date: response.data.start_date,
            end_date: response.data.end_date,
            leave_type: response.data.leave_type,
            reason: response.data.reason,
            status: response.data.status
          };
          return this.convertResponseToRequest(leaveResponse);
        }),
        catchError(this.handleError)
      );
  }

  getLeaveRequests(): Observable<LeaveRequest[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<LeaveResponse[]>(`${this.apiUrl}/leave`, { headers })
      .pipe(
        map(responses => responses.map(response => this.convertResponseToRequest(response))),
        catchError(this.handleError)
      );
  }

  getLeaveRequestById(id: string): Observable<LeaveRequest> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<LeaveResponse>(`${this.apiUrl}/leaves/${id}`, { headers })
      .pipe(
        map(response => this.convertResponseToRequest(response)),
        catchError(this.handleError)
      );
  }

  updateLeaveRequestStatus(id: string, status: 'Approved' | 'Rejected'): Observable<LeaveRequest> {
    const headers = this.authService.getAuthHeaders();
    return this.http.patch<LeaveResponse>(
      `${this.apiUrl}/leaves/${id}/status`,
      { status },
      { headers }
    ).pipe(
      map(response => this.convertResponseToRequest(response)),
      catchError(this.handleError)
    );
  }

  getEmployeeLeaveRequests(employeeId: string): Observable<LeaveRequest[]> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get<LeaveResponse[]>(`${this.apiUrl}/leaves/employee/${employeeId}`, { headers })
      .pipe(
        map(responses => responses.map(response => this.convertResponseToRequest(response))),
        catchError(this.handleError)
      );
  }

  submitLeave(leave: LeaveRequest): Observable<LeaveResponse> {
    console.log('Submitting leave request:', leave);
    const headers = this.authService.getAuthHeaders();
    const requestData = {
      employee_id: leave.employeeId,
      start_date: leave.startDate,
      end_date: leave.endDate,
      leave_type: leave.type,
      reason: leave.reason
    };
    
    return this.http.post<LeaveResponse>(`${this.apiUrl}/leave`, requestData, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  getLeaves(): Observable<LeaveResponse[]> {
    console.log('Fetching leaves');
    const headers = this.authService.getAuthHeaders();
    return this.http.get<LeaveResponse[]>(`${this.apiUrl}/leave`, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  getAllLeaves(): Observable<LeaveRequest[]> {
    if (!this.authService.isManager()) {
      return throwError(() => new Error('Only managers can view all leave requests'));
    }
    try {
      const headers = this.authService.getAuthHeaders();
      console.log('Fetching all leaves with headers:', headers);
      return this.http.get<LeaveResponse[]>(`${this.apiUrl}/leaves/all`, { headers })
        .pipe(
          map((response: LeaveResponse[]) => {
            console.log('Received response:', response);
            return response.map(leave => this.convertResponseToRequest(leave));
          }),
          catchError(error => {
            console.error('Error in getAllLeaves:', error);
            return this.handleError(error);
          })
        );
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return throwError(() => new Error('Authentication error'));
    }
  }

  approveLeave(leaveId: string): Observable<LeaveResponse> {
    console.log('Approving leave:', leaveId);
    if (!this.authService.isManager()) {
      console.error('Non-manager attempted to approve leave');
      return throwError(() => new Error('Only managers can approve leave requests'));
    }
    const headers = this.authService.getAuthHeaders();
    return this.http.post<LeaveResponse>(`${this.apiUrl}/leave/${leaveId}/approve`, {}, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  rejectLeave(leaveId: string): Observable<LeaveResponse> {
    console.log('Rejecting leave:', leaveId);
    if (!this.authService.isManager()) {
      console.error('Non-manager attempted to reject leave');
      return throwError(() => new Error('Only managers can reject leave requests'));
    }
    const headers = this.authService.getAuthHeaders();
    return this.http.post<LeaveResponse>(`${this.apiUrl}/leave/${leaveId}/reject`, {}, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteLeave(leaveId: string): Observable<void> {
    console.log('Deleting leave:', leaveId);
    const headers = this.authService.getAuthHeaders();
    return this.http.delete<void>(`${this.apiUrl}/leave/${leaveId}`, { headers })
      .pipe(catchError(this.handleError));
  }

  private normalizeStatus(status: string): 'Pending' | 'Approved' | 'Rejected' {
    const normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    if (['Pending', 'Approved', 'Rejected'].includes(normalized)) {
      return normalized as 'Pending' | 'Approved' | 'Rejected';
    }
    return 'Pending';
  }
} 