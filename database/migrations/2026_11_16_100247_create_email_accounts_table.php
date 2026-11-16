<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_accounts', function (Blueprint $table) {
            $table->increments('account_id');                      // int unsigned AUTO_INCREMENT PK
            $table->string('label', 100)->default('');
            $table->string('email', 150);
            $table->string('smtp_host', 255)->default('smtp.gmail.com');
            $table->unsignedSmallInteger('smtp_port')->default(587);
            $table->enum('smtp_encryption', ['ssl', 'tls'])->default('tls');
            $table->text('smtp_pass');
            $table->unsignedSmallInteger('daily_limit')->default(450);
            $table->unsignedInteger('sent_today')->default(0);
            $table->date('sent_date')->nullable();
            $table->unsignedBigInteger('total_sent')->default(0);
            $table->unsignedInteger('priority')->default(1);
            $table->boolean('is_active')->default(true);           // tinyint(1)
            $table->dateTime('exhausted_until')->nullable();
            $table->string('last_error', 500)->nullable();
            $table->dateTime('last_used_at')->nullable();
            $table->timestamps();                                  // created_at, updated_at (nullable timestamps)

            $table->unique('email', 'uq_email_account');
            $table->index(['is_active', 'priority'], 'idx_ea_queue');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_accounts');
    }
};