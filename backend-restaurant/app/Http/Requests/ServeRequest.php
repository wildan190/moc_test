<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ServeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_id' => 'required|string|in:A,B,C,D',
        ];
    }
}
