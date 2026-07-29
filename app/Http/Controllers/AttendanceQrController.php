<?php

namespace App\Http\Controllers;

use App\Models\AttendanceQrCode;
use App\Services\AttendanceQrService;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\SvgWriter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttendanceQrController extends Controller
{
    public function __invoke(
        Request $request,
        AttendanceQrCode $qrCode,
        AttendanceQrService $service
    ): Response {
        abort_unless(
            $request->user()->hasPermission('attendance.settings.manage')
                && $service->isValid($qrCode, $request->query('token')),
            404
        );
        $writer = new SvgWriter;
        $result = $writer->write(new QrCode(
            data: $service->scanUrl($qrCode),
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::High,
            size: 640,
            margin: 24,
        ));

        return response($result->getString(), 200, [
            'Content-Type' => $result->getMimeType(),
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
