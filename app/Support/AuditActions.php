<?php
namespace App\Support;

final class AuditActions
{
    public const LABELS = [
        'login_success' => 'Signed in',
        'login_failed' => 'Sign-in failed',
        'login_failed_unknown_account' => 'Sign-in failed (unknown account)',
        'login_blocked_locked' => 'Sign-in blocked (locked account)',
        'login_denied_inactive' => 'Sign-in denied (inactive account)',
        'login_denied_inactive_office' => 'Sign-in denied (inactive office)',
        'logout' => 'Signed out',
        'password_changed' => 'Password changed',
        'password_reset_requested' => 'Password reset code sent',
        'complaint_recorded' => 'Complaint recorded',
        'complaint_status_changed' => 'Complaint status changed',
        'complaint_assigned' => 'Complaint assigned',
        'complaint_reassigned' => 'Complaint reassigned',
        'complaint_coordination_added' => 'Coordinating office added',
        'complaint_acknowledged' => 'Assignment acknowledged',
        'complaint_update_added' => 'Investigation update added',
        'complaint_edited' => 'Complaint edited',
        'profile_updated' => 'Profile updated',
        'complaint_deleted' => 'Complaint deleted',
        'field_user_created' => 'Field office account created',
        'field_user_activated' => 'Field office account activated',
        'field_user_deactivated' => 'Field office account deactivated',
        'report_exported' => 'Report exported',
        'update_email_settings' => 'Email settings updated',
        'test_email_sent' => 'Test email sent',
    ];

    public const ENTITY_TYPES = ['complaints', 'users', 'email_settings'];

    public static function label(string $code): string
    {
        return self::LABELS[$code] ?? ucfirst(str_replace('_', ' ', $code));
    }
}