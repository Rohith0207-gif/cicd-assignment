import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { LeaveRequestComponent } from './components/leave-request/leave-request.component';
import { EmployeeDashboardComponent } from './components/employee-dashboard/employee-dashboard.component';
import { ManagerDashboardComponent } from './components/manager-dashboard/manager-dashboard.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { 
    path: 'dashboard', 
    component: EmployeeDashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'employee' }
  },
  { 
    path: 'manager-dashboard', 
    component: ManagerDashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'manager' }
  },
  { 
    path: 'leave-request', 
    component: LeaveRequestComponent,
    canActivate: [AuthGuard],
    data: { role: 'employee' }
  },
  { path: '**', component: LoginComponent }
];
