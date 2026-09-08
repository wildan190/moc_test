<?php

namespace App\Http\Controllers;

use App\Actions\ArriveAction;
use App\Actions\GetStatusAction;
use App\Actions\ServeAction;
use App\Actions\GetHistoryAction;
use App\Http\Requests\ArriveRequest;
use App\Http\Requests\ServeRequest;
use Illuminate\Http\JsonResponse;

use App\Actions\SeatAction;
use App\Http\Requests\SeatRequest;

class QueueController extends Controller
{
    public function arrive(ArriveRequest $request, ArriveAction $action): JsonResponse
    {
        $customer = $action->execute($request);
        return response()->json([
            'message' => 'Arrival processed successfully',
            'customer' => $customer
        ], 201);
    }

    public function status(GetStatusAction $action): JsonResponse
    {
        $status = $action->execute();
        return response()->json($status);
    }

    public function serve(ServeRequest $request, ServeAction $action): JsonResponse
    {
        $table = $action->execute($request);
        return response()->json([
            'message' => 'Table served/completed successfully',
            'table' => $table
        ]);
    }

    public function seat(SeatRequest $request, SeatAction $action): JsonResponse
    {
        $table = $action->execute($request);
        return response()->json([
            'message' => 'Customer seated successfully',
            'table' => $table
        ]);
    }

    public function history(GetHistoryAction $action): JsonResponse
    {
        $history = $action->execute();
        return response()->json($history);
    }

    public function ticket(int $id): JsonResponse
    {
        $customer = \App\Models\QueueMember::with('table')->find($id);
        if (!$customer) {
            return response()->json(['message' => 'Tiket antrean tidak ditemukan'], 404);
        }

        // Hitung posisi antrean di depan pelanggan jika masih waiting
        $aheadCount = 0;
        if ($customer->status === 'waiting') {
            $aheadCount = \App\Models\QueueMember::where('status', 'waiting')
                ->where('joined_at', '<', $customer->joined_at)
                ->count();
        }

        return response()->json([
            'customer' => $customer,
            'ahead_count' => $aheadCount,
            'estimated_wait_minutes' => max(5, $aheadCount * 12),
        ]);
    }
}
