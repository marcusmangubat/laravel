<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->unsignedInteger('office_id');
            $table->string('full_name', 150);
            $table->string('username', 60);
            $table->string('email', 150);
            $table->string('position_title', 120);
            $table->string('contact_number', 50);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->unsignedInteger('reviewed_by')->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->string('reject_reason', 500)->nullable();
            $table->unsignedInteger('created_user_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('username');
            $table->index('email');

            $table->foreign('office_id')->references('office_id')->on('offices');
            $table->foreign('reviewed_by')->references('user_id')->on('users')->nullOnDelete();
            $table->foreign('created_user_id')->references('user_id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('access_requests');
    }
};
