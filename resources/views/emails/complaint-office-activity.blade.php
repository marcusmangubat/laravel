@php
  $row = fn($k, $v) => $v !== null && $v !== '' ? "<tr><td style='color:#64748b;white-space:nowrap;vertical-align:top'><b>{$k}</b></td><td>".e($v)."</td></tr>" : '';
  $location = collect([
      $c['specific_location'] ?? null,
      !empty($c['barangay']) ? 'Brgy. '.$c['barangay'] : null,
      $c['municipality'] ?? null,
      $c['province_name'] ?? null,
  ])->filter()->implode(', ');
  $canOpen = $event !== 'deleted' && $role !== 'removed';
@endphp
<!doctype html>
<html>
<body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:680px">
  <h2 style="color:#0f3d2e;margin-bottom:4px">{{ $label }}</h2>
  <p style="margin-top:0;color:#64748b">DENR RDAC IV-A Complaint Management System</p>

  <p>Hello {{ $recipientName }},</p>
  <p>
    <b>{{ $actor->full_name ?? 'The RDAC' }}</b>
    @if(!empty($actor->position_title)) ({{ $actor->position_title }}) @endif
    made this change on {{ $when }}.
  </p>

  @if($event === 'assigned')
    <p style="background:#f1f5f9;padding:10px;border-radius:6px">
      @if($role === 'primary')
        This complaint is now assigned to <b>your office</b> as the <b>primary (responsible) office</b>.
        @if($previousOffice)<br><b>Previously handled by:</b> {{ $previousOffice }}@endif
      @elseif($role === 'coordinating')
        <b>Your office</b> was added as a <b>coordinating office</b>. You can acknowledge the complaint and add updates. The primary office ({{ $c['office_name'] ?? 'not yet assigned' }}) owns the case.
      @else
        This complaint was reassigned from <b>your office</b> to <b>{{ $assignedOffice ?? 'another office' }}</b>. Your office is no longer responsible for it.
      @endif
      @if(!empty($extra['target_date']))<br><b>Target response date:</b> {{ $extra['target_date'] }}@endif
      @if(!empty($extra['reason']))<br><b>Reason:</b> {!! nl2br(e($extra['reason'])) !!}@endif
      @if($role !== 'removed')<br><b>Please acknowledge the assignment in the system.</b>@endif
    </p>
  @endif

  @if($event === 'status_changed')
    <p style="background:#f1f5f9;padding:10px;border-radius:6px">
      <b>Status:</b> {{ $extra['from_status'] ?? '—' }} &rarr; <b>{{ $c['status_name'] ?? '—' }}</b>
      @if(!empty($extra['reason']))<br><b>Reason:</b> {!! nl2br(e($extra['reason'])) !!}@endif
      @if(($c['status_code'] ?? '') === 'for_info')<br><b>RDAC needs additional information. Please submit it in the system.</b>@endif
    </p>
  @endif

  @if($event === 'update_added')
    <p style="background:#f1f5f9;padding:10px;border-radius:6px">
      {!! nl2br(e($extra['details'] ?? '')) !!}
      @if(!empty($extra['photo_count']))<br><i>{{ $extra['photo_count'] }} photo(s) attached. View them in the system.</i>@endif
    </p>
  @endif

  @if($event === 'edited' && $changes)
    <p><b>What changed:</b></p>
    <table cellpadding="6" style="border:1px solid #e2e8f0;border-collapse:collapse;width:100%">
      <tr style="background:#f8fafc"><th align="left">Field</th><th align="left">Before</th><th align="left">After</th></tr>
      @foreach($changes as $field => $v)
        <tr><td>{{ str_replace('_', ' ', $field) }}</td><td>{{ $v['from'] }}</td><td>{{ $v['to'] }}</td></tr>
      @endforeach
    </table>
  @endif

  <p><b>Complaint details</b></p>
  <table cellpadding="6" style="border:1px solid #e2e8f0;border-collapse:collapse;width:100%">
    {!! $row('Reference no.', $c['reference_no'] ?? null) !!}
    {!! $row('Title', $c['title'] ?? null) !!}
    {!! $row('Current status', $c['status_name'] ?? null) !!}
    {!! $row('Priority', isset($c['priority']) ? ucfirst($c['priority']) : null) !!}
    {!! $row('Category', $c['category_name'] ?? null) !!}
    {!! $row('Responsible office', $c['office_name'] ?? null) !!}
    {!! $row('Your office role', $role === 'primary' ? 'Primary office' : ($role === 'coordinating' ? 'Coordinating office' : null)) !!}
    {!! $row('Received through', isset($c['received_channel']) ? ucfirst(str_replace('_',' ',$c['received_channel'])) : null) !!}
    {!! $row('Date received', $c['received_at'] ?? null) !!}
    {!! $row('Date of incident', $c['incident_datetime'] ?? null) !!}
    {!! $row('Target response date', $c['target_date'] ?? null) !!}
    {!! $row('Overdue', $overdue ? 'YES' : null) !!}
    {!! $row('Location', $location) !!}
    @if(!empty($c['is_anonymous']))
      {!! $row('Complainant', 'Anonymous') !!}
    @else
      {!! $row('Complainant', $c['complainant_name'] ?? null) !!}
      {!! $row('Complainant contact', $c['complainant_contact'] ?? null) !!}
      {!! $row('Complainant email', $c['complainant_email'] ?? null) !!}
    @endif
  </table>

  @if(!empty($c['description']))
    <p><b>Description</b></p>
    <p style="background:#f8fafc;padding:10px;border-radius:6px">{!! nl2br(e($c['description'])) !!}</p>
  @endif

  @if($canOpen)
    <p><a href="{{ $link }}" style="background:#15803d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open complaint in the system</a></p>
  @endif

  <p style="color:#64748b;font-size:12px">Automated message. Do not reply.</p>
</body>
</html>