<?php

// app/Support/ComplaintFields.php
// Port of includes/complaint_fields.php. Same rules, same messages, so the screen behaves as before.
// Use ComplaintFields::fromInput($request->all()) in the store() method of your list controller too.

namespace App\Support;

use DateTime;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ComplaintFields
{
    public static function parseDt(string $s): ?string
    {
        foreach (['Y-m-d\TH:i', 'Y-m-d\TH:i:s', 'Y-m-d H:i:s', 'Y-m-d H:i'] as $fmt) {
            $d = DateTime::createFromFormat($fmt, $s);
            if ($d && $d->format($fmt) === $s) {
                return $d->format('Y-m-d H:i:s');
            }
        }
        return null;
    }

    /**
     * @return array fields in the shape ComplaintWorkflow::updateComplaint() expects
     * @throws ValidationException
     */
    public static function fromInput(array $post): array
    {
        $in = static fn (string $k): string => trim((string) ($post[$k] ?? ''));
        $errors = [];

        $title = $in('title');
        if ($title === '') {
            $errors['title'] = 'Enter a title or subject.';
        } elseif (mb_strlen($title) > 200) {
            $errors['title'] = 'Keep the title within 200 characters.';
        }

        $description = $in('description');
        if ($description === '') {
            $errors['description'] = 'Enter a description of the complaint.';
        } elseif (mb_strlen($description) > 10000) {
            $errors['description'] = 'The description is too long (10,000 characters maximum).';
        }

        $channel = $in('received_channel');
        if (! array_key_exists($channel, \App\Services\ComplaintWorkflow::CHANNELS)) {
            $errors['received_channel'] = 'Choose how the complaint was received.';
        }
        $priority = $in('priority') ?: 'normal';
        if (! in_array($priority, ['low', 'normal', 'high', 'urgent'], true)) {
            $errors['priority'] = 'Choose a valid priority.';
        }

        $receivedAt = self::parseDt($in('received_at'));
        if ($receivedAt === null) {
            $errors['received_at'] = 'Enter the date and time the complaint was received.';
        } elseif (strtotime($receivedAt) > time() + 300) {
            $errors['received_at'] = 'The received date cannot be in the future.';
        }

        $incident = null;
        if ($in('incident_datetime') !== '') {
            $incident = self::parseDt($in('incident_datetime'));
            if ($incident === null) {
                $errors['incident_datetime'] = 'Enter a valid incident date and time, or leave it blank if unknown.';
            } elseif ($receivedAt !== null && strtotime($incident) > strtotime($receivedAt)) {
                $errors['incident_datetime'] = 'The incident cannot be after the received date.';
            }
        }

        $targetDate = null;
        if ($in('target_date') !== '') {
            $d = DateTime::createFromFormat('Y-m-d', $in('target_date'));
            if (! $d || $d->format('Y-m-d') !== $in('target_date')) {
                $errors['target_date'] = 'Enter a valid target date.';
            } elseif ($receivedAt !== null && $d->format('Y-m-d') < substr($receivedAt, 0, 10)) {
                $errors['target_date'] = 'The target date cannot be before the received date.';
            } else {
                $targetDate = $d->format('Y-m-d');
            }
        }

        $categoryId = null;
        if ($in('category_id') !== '') {
            $categoryId = (int) $in('category_id');
            $ok = DB::table('complaint_categories')->where('category_id', $categoryId)->where('is_active', 1)->exists();
            if (! $ok) {
                $errors['category_id'] = 'Choose a valid category.';
            }
        }

        $provinceId = null;
        if ($in('province_id') !== '') {
            $provinceId = (int) $in('province_id');
            $ok = DB::table('provinces')->where('province_id', $provinceId)->where('is_active', 1)->exists();
            if (! $ok) {
                $errors['province_id'] = 'Choose a valid province.';
            }
        }

        $municipality = $in('municipality');
        $barangay = $in('barangay');
        $specific = $in('specific_location');
        if (mb_strlen($municipality) > 100) {
            $errors['municipality'] = 'Maximum 100 characters.';
        }
        if (mb_strlen($barangay) > 100) {
            $errors['barangay'] = 'Maximum 100 characters.';
        }
        if (mb_strlen($specific) > 255) {
            $errors['specific_location'] = 'Maximum 255 characters.';
        }

        $anonymous = filter_var($post['is_anonymous'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $cName = $cContact = $cEmail = null;
        if (! $anonymous) {
            $cName = $in('complainant_name');
            $cContact = $in('complainant_contact');
            $cEmail = $in('complainant_email');
            if (mb_strlen($cName) > 150) {
                $errors['complainant_name'] = 'Maximum 150 characters.';
            }
            if (mb_strlen($cContact) > 100) {
                $errors['complainant_contact'] = 'Maximum 100 characters.';
            }
            if ($cEmail !== '' && (mb_strlen($cEmail) > 150 || ! filter_var($cEmail, FILTER_VALIDATE_EMAIL))) {
                $errors['complainant_email'] = 'Enter a valid email address.';
            }
            $cName = $cName ?: null;
            $cContact = $cContact ?: null;
            $cEmail = $cEmail ?: null;
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return [
            'title' => $title,
            'category_id' => $categoryId,
            'description' => $description,
            'channel' => $channel,
            'received_at' => $receivedAt,
            'incident' => $incident,
            'province_id' => $provinceId,
            'municipality' => $municipality ?: null,
            'barangay' => $barangay ?: null,
            'specific' => $specific ?: null,
            'outside' => 0, // the PHP version always saved 0 here
            'complainant_name' => $cName,
            'complainant_contact' => $cContact,
            'complainant_email' => $cEmail,
            'anonymous' => $anonymous,
            'priority' => $priority,
            'target_date' => $targetDate,
        ];
    }
}