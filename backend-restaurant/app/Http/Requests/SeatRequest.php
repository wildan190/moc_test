<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SeatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'queue_member_id' => 'required|integer|exists:queue_members,id',
            'table_id' => 'required|string|exists:tables,id',
        ];
    }
}
