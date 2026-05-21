<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiHelpController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\ManagerApprovalController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.store');
    Route::get('/forgot-password', [AuthController::class, 'showForgotPassword'])->name('password.request');
    Route::post('/forgot-password', [AuthController::class, 'sendResetLink'])->name('password.email');
    Route::get('/reset-password/{token}', [AuthController::class, 'showResetPassword'])->name('password.reset');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->name('password.update');
    Route::get('/two-factor', [AuthController::class, 'showTwoFactor'])->name('two-factor.show');
    Route::post('/two-factor', [AuthController::class, 'verifyTwoFactor'])->name('two-factor.verify');
});

Route::middleware('auth')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::post('/leave-requests', [LeaveRequestController::class, 'store'])->name('leave-requests.store');
    Route::delete('/leave-requests/{leaveRequest}', [LeaveRequestController::class, 'destroy'])->name('leave-requests.destroy');
    Route::post('/ai-help', [AiHelpController::class, 'ask'])->name('ai-help.ask');

    Route::middleware('role:manager,hr,admin')->group(function () {
        Route::get('/approvals', [ManagerApprovalController::class, 'index'])->name('approvals.index');
        Route::patch('/approvals/{leaveRequest}', [ManagerApprovalController::class, 'update'])->name('approvals.update');
    });

    Route::middleware('role:hr,admin')->group(function () {
        Route::get('/admin', [AdminController::class, 'index'])->name('admin.index');
        Route::post('/admin/departments', [AdminController::class, 'storeDepartment'])->name('admin.departments.store');
        Route::post('/admin/leave-types', [AdminController::class, 'storeLeaveType'])->name('admin.leave-types.store');
        Route::post('/admin/holidays', [AdminController::class, 'storeHoliday'])->name('admin.holidays.store');
        Route::post('/admin/users', [AdminController::class, 'storeUser'])->name('admin.users.store');
        Route::patch('/admin/users/{user}/status', [AdminController::class, 'updateUserStatus'])->name('admin.users.status');
        Route::patch('/admin/leave-types/{leaveType}/status', [AdminController::class, 'updateLeaveTypeStatus'])->name('admin.leave-types.status');
        Route::patch('/admin/departments/{department}/status', [AdminController::class, 'updateDepartmentStatus'])->name('admin.departments.status');
        Route::patch('/admin/holidays/{holiday}/status', [AdminController::class, 'updateHolidayStatus'])->name('admin.holidays.status');
        Route::post('/admin/balances', [AdminController::class, 'overrideBalance'])->name('admin.balances.override');
        Route::get('/reports/monthly', [ReportController::class, 'monthly'])->name('reports.monthly');
    });
});
