import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LeaveService, LeaveRequest } from '../../services/leave.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-leave-request',
  templateUrl: './leave-request.component.html',
  styleUrls: ['./leave-request.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class LeaveRequestComponent implements OnInit {
  leaveForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  isManager: boolean = false;
  leaveTypes = ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other'];
  currentUser: any = null;

  constructor(
    private fb: FormBuilder,
    private leaveService: LeaveService,
    private authService: AuthService,
    private router: Router
  ) {
    this.isManager = this.authService.isManager();
    this.leaveForm = this.fb.group({
      leave_type: ['', Validators.required],
      other_type: [''],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(10)]]
    });

    // Add validation for other_type when leave_type is 'Other'
    this.leaveForm.get('leave_type')?.valueChanges.subscribe(value => {
      const otherTypeControl = this.leaveForm.get('other_type');
      if (value === 'Other') {
        otherTypeControl?.setValidators([Validators.required]);
      } else {
        otherTypeControl?.clearValidators();
        otherTypeControl?.setValue('');
      }
      otherTypeControl?.updateValueAndValidity();
    });
  }

  async ngOnInit() {
    if (this.isManager) {
      this.router.navigate(['/dashboard']);
    }
    this.currentUser = await firstValueFrom(this.authService.currentUser$);
  }

  validateDates() {
    const startDate = this.leaveForm.get('start_date')?.value;
    const endDate = this.leaveForm.get('end_date')?.value;
    
    if (startDate && endDate && startDate > endDate) {
      this.leaveForm.get('end_date')?.setErrors({ invalidDate: true });
    } else {
      this.leaveForm.get('end_date')?.setErrors(null);
    }
  }

  async onSubmit() {
    if (this.leaveForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const formValue = this.leaveForm.value;
      const leaveRequest: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
        employeeId: this.currentUser?.uid || '',
        startDate: formValue.start_date,
        endDate: formValue.end_date,
        type: formValue.leave_type === 'Other' ? formValue.other_type : formValue.leave_type,
        reason: formValue.reason
      };
      
      try {
        console.log('Submitting leave request:', leaveRequest);
        await this.leaveService.createLeaveRequest(leaveRequest).toPromise();
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        console.error('Error submitting leave request:', error);
        this.isLoading = false;
        this.errorMessage = this.getErrorMessage(error);
      }
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
    if (error.error?.error) {
      return error.error.error;
    }
    return 'Failed to submit leave request. Please try again.';
  }

  navigateToDashboard() {
    this.router.navigate(['/dashboard']);
  }
} 