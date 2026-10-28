<?php

// config/complaints.php
// Replaces the admin_email and alert_recipient values that mailer_load_settings() read from the database.
// Set them in .env:
//   COMPLAINT_ADMIN_EMAIL=rdac@your-domain.gov.ph
//   COMPLAINT_ALERT_EMAIL=alerts@your-domain.gov.ph

return [
    'extra_admin_emails' => array_values(array_filter([
        env('COMPLAINT_ADMIN_EMAIL'),
        env('COMPLAINT_ALERT_EMAIL'),
    ])),
];