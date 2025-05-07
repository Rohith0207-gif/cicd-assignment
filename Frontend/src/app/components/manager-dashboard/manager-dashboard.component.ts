import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LeaveService, LeaveRequest as ServiceLeaveRequest } from '../../services/leave.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

interface LeaveRequest extends ServiceLeaveRequest {
  status: LeaveStatus;
}

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ManagerDashboardComponent implements OnInit {
  leaveRequests: LeaveRequest[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  isManager: boolean = true;

  constructor(
    private leaveService: LeaveService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated() || !this.authService.isManager()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadLeaveRequests();
  }

  loadLeaveRequests() {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.leaveService.getAllLeaves().subscribe({
      next: (leaves) => {
        console.log('Manager received leaves:', leaves);
        this.leaveRequests = leaves.map(leave => ({
          ...leave,
          status: (leave.status || 'Pending') as LeaveStatus
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading manager leaves:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to load leave requests';
      }
    });
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  approveLeave(id: string | undefined) {
    if (!id) return;
    this.leaveService.approveLeave(id).subscribe({
      next: () => this.loadLeaveRequests(),
      error: (error) => this.errorMessage = error.message || 'Failed to approve leave request'
    });
  }

  rejectLeave(id: string | undefined) {
    if (!id) return;
    this.leaveService.rejectLeave(id).subscribe({
      next: () => this.loadLeaveRequests(),
      error: (error) => this.errorMessage = error.message || 'Failed to reject leave request'
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
} 