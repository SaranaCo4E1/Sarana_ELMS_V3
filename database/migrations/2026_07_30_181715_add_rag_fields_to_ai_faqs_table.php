<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            Schema::ensureVectorExtensionExists();
        }

        Schema::table('ai_faqs', function (Blueprint $table) {
            $table->string('key')->nullable()->unique()->after('id');
            $table->string('category')->nullable()->after('key');
            $table->json('aliases_en')->nullable()->after('answer');
            $table->json('aliases_km')->nullable()->after('aliases_en');
            $table->string('content_hash', 64)->nullable()->after('aliases_km');
            $table->string('embedding_model')->nullable()->after('content_hash');
            $table->string('embedding_content_hash', 64)->nullable()->after('embedding_model');

            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $table->vector('embedding', dimensions: 768)->nullable()->after('embedding_content_hash');
            } else {
                $table->json('embedding')->nullable()->after('embedding_content_hash');
            }

            $table->timestamp('embedded_at')->nullable()->after('embedding');
            $table->index(['is_active', 'category']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_faqs', function (Blueprint $table) {
            $table->dropIndex(['is_active', 'category']);
            $table->dropUnique(['key']);
            $table->dropColumn([
                'key',
                'category',
                'aliases_en',
                'aliases_km',
                'content_hash',
                'embedding_model',
                'embedding_content_hash',
                'embedding',
                'embedded_at',
            ]);
        });
    }
};
