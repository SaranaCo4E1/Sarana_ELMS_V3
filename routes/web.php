<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiAssistantController;
use App\Http\Controllers\AiHelpController;
use App\Http\Controllers\ApplyLeaveController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AttendanceQrController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\ManagerApprovalController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TelegramController;
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

Route::get('/', function () {
    return inertia('Landing');
})->name('landing');

Route::get('/terms', function () {
    return inertia('Terms');
})->name('terms');

Route::get('/privacy', function () {
    return inertia('Privacy');
})->name('privacy');

Route::get('/support', [SupportController::class, 'index'])->name('support.index');
Route::post('/support', [SupportController::class, 'store'])->name('support.store');

Route::post('/telegram/webhook', [TelegramController::class, 'webhook'])->name('telegram.webhook');

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/calendar', CalendarController::class)->name('calendar.index');
    Route::get('/apply-leave', ApplyLeaveController::class)->name('apply-leave.index');
    Route::get('/ai-assistant', AiAssistantController::class)->name('ai-assistant.index');
    Route::get('/profile', [ProfileController::class, 'index'])->name('profile.index');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::patch('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
    Route::patch('/profile/two-factor', [ProfileController::class, 'updateTwoFactor'])->name('profile.two-factor');
    Route::get('/profile/telegram/connect', [TelegramController::class, 'connect'])->name('profile.telegram.connect');
    Route::post('/profile/telegram/disconnect', [TelegramController::class, 'disconnect'])->name('profile.telegram.disconnect');
    Route::post('/leave-requests', [LeaveRequestController::class, 'store'])->name('leave-requests.store');
    Route::delete('/leave-requests/{leaveRequest}', [LeaveRequestController::class, 'destroy'])->name('leave-requests.destroy');
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/ai-help', [AiHelpController::class, 'ask'])->name('ai-help.ask');
        Route::post('/ai-help/stream', [AiHelpController::class, 'stream'])->name('ai-help.stream');
    });
    Route::get('/attendance', [AttendanceController::class, 'index'])->name('attendance.index');
    Route::get('/attendance/scan/{qrCode}', [AttendanceController::class, 'showScan'])->name('attendance.scan');
    Route::post('/attendance/scan/{qrCode}', [AttendanceController::class, 'storeScan'])
        ->middleware('throttle:10,1')
        ->name('attendance.scan.store');
    Route::post('/attendance/punch', [AttendanceController::class, 'storeSelfServicePunch'])
        ->middleware('throttle:10,1')
        ->name('attendance.punch.store');
    Route::get('/attendance/qr/{qrCode}/image', AttendanceQrController::class)->name('attendance.qr.image');
    Route::post('/attendance/sites', [AttendanceController::class, 'storeSite'])->name('attendance.sites.store');
    Route::patch('/attendance/sites/{site}', [AttendanceController::class, 'updateSite'])->name('attendance.sites.update');
    Route::post('/attendance/sites/{site}/regenerate-qr', [AttendanceController::class, 'regenerateQr'])->name('attendance.qr.regenerate');
    Route::post('/attendance/schedules', [AttendanceController::class, 'storeSchedule'])->name('attendance.schedules.store');
    Route::patch('/attendance/schedules/{schedule}', [AttendanceController::class, 'updateSchedule'])->name('attendance.schedules.update');
    Route::post('/attendance/events/manual', [AttendanceController::class, 'storeManualEvent'])->name('attendance.events.manual');
    Route::patch('/attendance/events/{event}', [AttendanceController::class, 'correctEvent'])->name('attendance.events.correct');
    Route::patch('/attendance/events/{event}/review', [AttendanceController::class, 'reviewEvent'])->name('attendance.events.review');
    Route::get('/attendance/export', [AttendanceController::class, 'export'])->name('attendance.export');
    Route::get('/approvals/attachments/{leaveAttachment}/preview', [ManagerApprovalController::class, 'previewAttachment'])->name('approvals.attachments.preview');
    Route::get('/approvals/attachments/{leaveAttachment}/download', [ManagerApprovalController::class, 'downloadAttachment'])->name('approvals.attachments.download');

    Route::middleware('permission:team.view')->group(function () {
        Route::get('/team', [TeamController::class, 'index'])->name('team.index');
    });

    Route::middleware('permission:approvals.manage')->group(function () {
        Route::get('/approvals', [ManagerApprovalController::class, 'index'])->name('approvals.index');
        Route::patch('/approvals/{leaveRequest}', [ManagerApprovalController::class, 'update'])->name('approvals.update');
    });

    Route::middleware('permission:users.manage,departments.manage,leave_types.manage,holidays.manage,balances.override,reports.view,audit_logs.view')->group(function () {
        Route::get('/admin', [AdminController::class, 'index'])->name('admin.index');
    });

    Route::middleware('permission:departments.manage')->group(function () {
        Route::post('/admin/departments', [AdminController::class, 'storeDepartment'])->name('admin.departments.store');
        Route::patch('/admin/departments/{department}', [AdminController::class, 'updateDepartment'])->name('admin.departments.update');
        Route::patch('/admin/departments/{department}/status', [AdminController::class, 'updateDepartmentStatus'])->name('admin.departments.status');
    });

    Route::middleware('permission:leave_types.manage')->group(function () {
        Route::post('/admin/leave-types', [AdminController::class, 'storeLeaveType'])->name('admin.leave-types.store');
        Route::patch('/admin/leave-types/{leaveType}', [AdminController::class, 'updateLeaveType'])->name('admin.leave-types.update');
        Route::patch('/admin/leave-types/{leaveType}/status', [AdminController::class, 'updateLeaveTypeStatus'])->name('admin.leave-types.status');
    });

    Route::middleware('permission:holidays.manage')->group(function () {
        Route::post('/admin/holidays', [AdminController::class, 'storeHoliday'])->name('admin.holidays.store');
        Route::patch('/admin/holidays/{holiday}', [AdminController::class, 'updateHoliday'])->name('admin.holidays.update');
        Route::patch('/admin/holidays/{holiday}/status', [AdminController::class, 'updateHolidayStatus'])->name('admin.holidays.status');
    });

    Route::middleware('permission:users.manage')->group(function () {
        Route::post('/admin/users', [AdminController::class, 'storeUser'])->name('admin.users.store');
        Route::patch('/admin/users/{user}', [AdminController::class, 'updateUser'])->name('admin.users.update');
        Route::patch('/admin/users/{user}/status', [AdminController::class, 'updateUserStatus'])->name('admin.users.status');
    });

    Route::middleware('permission:balances.override')->group(function () {
        Route::post('/admin/balances', [AdminController::class, 'overrideBalance'])->name('admin.balances.override');
    });

    Route::middleware('permission:reports.self.view,reports.team.view,reports.view')->group(function () {
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/reports/export/leave', [ReportController::class, 'exportLeave'])->name('reports.export.leave');
        Route::get('/reports/export/attendance', [ReportController::class, 'exportAttendance'])->name('reports.export.attendance');
    });

    Route::middleware('permission:reports.view')->group(function () {
        Route::get('/reports/monthly', [ReportController::class, 'monthly'])->name('reports.monthly');
    });

    Route::middleware('permission:audit_logs.view')->group(function () {
        Route::get('/reports/audit-logs', [ReportController::class, 'auditLogs'])->name('reports.audit-logs');
    });

    Route::middleware('permission:support_tickets.manage')->group(function () {
        Route::get('/support-tickets', [SupportController::class, 'tickets'])->name('support.tickets');
    });

    Route::middleware('role:admin')->prefix('roles-permissions')->name('roles-permissions.')->group(function () {
        Route::get('/', [RolePermissionController::class, 'index'])->name('index');
        Route::post('/roles', [RolePermissionController::class, 'storeRole'])->name('roles.store');
        Route::patch('/roles/{role}/permissions', [RolePermissionController::class, 'updateRolePermissions'])->name('roles.permissions.update');
    });
});
