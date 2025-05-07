import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LeaveService, LeaveRequest } from '../../services/leave.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class DashboardComponent implements OnInit {
  leaveRequests: LeaveRequest[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  isManager: boolean = false;

  constructor(
    private leaveService: LeaveService,
    private authService: AuthService,
    private router: Router
  ) {
    this.isManager = this.authService.isManager();
  }

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadLeaveRequests();
  }

  loadLeaveRequests() {
    this.isLoading = true;
    this.errorMessage = '';
    
    if (this.isManager) {
      this.leaveService.getAllLeaves().subscribe({
        next: (leaves: LeaveRequest[]) => {
          this.leaveRequests = leaves;
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = this.getErrorMessage(error);
        }
      });
    } else {
      this.leaveService.getLeaveRequests().subscribe({
        next: (leaves: LeaveRequest[]) => {
          this.leaveRequests = leaves;
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = this.getErrorMessage(error);
        }
      });
    }
  }

  private getErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error.error?.message) {
      return error.error.message;
    }
    if (error.error?.detail) {
      return error.error.detail;
    }
    return 'An error occurred while loading leave requests';
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-success';
      case 'rejected':
        return 'bg-danger';
      case 'pending':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  getPendingCount(): number {
    return this.leaveRequests.filter(request => request.status === 'Pending').length;
  }

  getApprovedCount(): number {
    return this.leaveRequests.filter(request => request.status === 'Approved').length;
  }

  getRejectedCount(): number {
    return this.leaveRequests.filter(request => request.status === 'Rejected').length;
  }

  approveLeave(id: string | undefined) {
    if (!id) return;
    this.leaveService.approveLeave(id).subscribe({
      next: () => this.loadLeaveRequests(),
      error: (error) => this.errorMessage = this.getErrorMessage(error)
    });
  }

  rejectLeave(id: string | undefined) {
    if (!id) return;
    this.leaveService.rejectLeave(id).subscribe({
      next: () => this.loadLeaveRequests(),
      error: (error) => this.errorMessage = this.getErrorMessage(error)
    });
  }

  deleteLeave(id: string | undefined) {
    if (!id) return;
    this.leaveService.deleteLeave(id).subscribe({
      next: () => this.loadLeaveRequests(),
      error: (error) => this.errorMessage = this.getErrorMessage(error)
    });
  }

  logout() {
    this.authService.logout();
  }

  navigateToLeaveRequest() {
    this.router.navigate(['/leave-request']);
  }
} 