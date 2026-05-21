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
    Route::get('/', [DashboardController::class, 'dashboard'])->name('dashboard');
    Route::get('/leave-requests', [DashboardController::class, 'leaveRequests'])->name('leave-requests.index');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::post('/password/force-change', [AuthController::class, 'forceChangePassword'])->name('password.force-change');
    Route::post('/password/change', [AuthController::class, 'changePassword'])->name('password.change');
    Route::post('/profile/photo', [AuthController::class, 'updateProfilePhoto'])->name('profile.photo');
    Route::post('/leave-requests', [LeaveRequestController::class, 'store'])->name('leave-requests.store');
    Route::delete('/leave-requests/{leaveRequest}', [LeaveRequestController::class, 'destroy'])->name('leave-requests.destroy');
    Route::get('/attachments/{attachment}', [LeaveRequestController::class, 'downloadAttachment'])->name('attachments.download');
    Route::patch('/notifications/{notification}/read', [DashboardController::class, 'markNotificationRead'])->name('notifications.read');
    Route::post('/ai-help', [AiHelpController::class, 'ask'])->name('ai-help.ask');

    Route::middleware('role:manager,hr,admin')->group(function () {
        Route::get('/approvals', [ManagerApprovalController::class, 'index'])->name('approvals.index');
        Route::patch('/approvals/{leaveRequest}', [ManagerApprovalController::class, 'update'])->name('approvals.update');
    });

    Route::middleware('role:hr,admin')->group(function () {
        Route::get('/admin', [AdminController::class, 'index'])->name('admin.index');

        Route::post('/admin/departments', [AdminController::class, 'storeDepartment'])->name('admin.departments.store');
        Route::put('/admin/departments/{department}', [AdminController::class, 'updateDepartment'])->name('admin.departments.update');
        Route::delete('/admin/departments/{department}', [AdminController::class, 'destroyDepartment'])->name('admin.departments.destroy');

        Route::post('/admin/leave-types', [AdminController::class, 'storeLeaveType'])->name('admin.leave-types.store');
        Route::put('/admin/leave-types/{leaveType}', [AdminController::class, 'updateLeaveType'])->name('admin.leave-types.update');
        Route::delete('/admin/leave-types/{leaveType}', [AdminController::class, 'destroyLeaveType'])->name('admin.leave-types.destroy');

        Route::post('/admin/holidays', [AdminController::class, 'storeHoliday'])->name('admin.holidays.store');
        Route::put('/admin/holidays/{holiday}', [AdminController::class, 'updateHoliday'])->name('admin.holidays.update');
        Route::delete('/admin/holidays/{holiday}', [AdminController::class, 'destroyHoliday'])->name('admin.holidays.destroy');

        Route::post('/admin/users', [AdminController::class, 'storeUser'])->name('admin.users.store');
        Route::put('/admin/users/{user}', [AdminController::class, 'updateUser'])->name('admin.users.update');
        Route::delete('/admin/users/{user}', [AdminController::class, 'destroyUser'])->name('admin.users.destroy');

        Route::post('/admin/balances', [AdminController::class, 'overrideBalance'])->name('admin.balances.override');
        Route::put('/admin/balances/{balance}', [AdminController::class, 'updateBalance'])->name('admin.balances.update');
        Route::delete('/admin/balances/{balance}', [AdminController::class, 'destroyBalance'])->name('admin.balances.destroy');
        Route::get('/reports/monthly', [ReportController::class, 'monthly'])->name('reports.monthly');
    });
});
