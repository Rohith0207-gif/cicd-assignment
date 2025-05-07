import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LeaveService, LeaveResponse } from '../../services/leave.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

interface LeaveRequest {
  leave_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: string;
}

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class EmployeeDashboardComponent implements OnInit {
  leaveRequests: LeaveRequest[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private leaveService: LeaveService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated() || this.authService.isManager()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadLeaveRequests();
  }

  loadLeaveRequests() {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.leaveService.getLeaves().subscribe({
      next: (response: LeaveResponse[]) => {
        this.leaveRequests = response.map(request => ({
          ...request,
          status: request.status || 'Pending'
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading leaves:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to load leave requests';
      }
    });
  }

  deleteLeave(leaveId: string) {
    if (confirm('Are you sure you want to delete this leave request?')) {
      this.leaveService.deleteLeave(leaveId).subscribe({
        next: () => {
          this.loadLeaveRequests();
        },
        error: (error) => {
          this.errorMessage = error.message || 'Failed to delete leave request';
        }
      });
    }
  }

  navigateToLeaveRequest() {
    this.router.navigate(['/leave-request']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }
} 