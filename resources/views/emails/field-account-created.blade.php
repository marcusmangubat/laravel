<!doctype html>
<html>
<body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5">
  <h2 style="color:#0f3d2e">DENR RDAC IV-A Complaint Management System</h2>
  <p>Hello {{ $fullName }},</p>
  <p>An account has been created for you. Your sign-in details:</p>
  <table cellpadding="6" style="border:1px solid #e2e8f0;border-collapse:collapse">
    <tr><td><b>Office</b></td><td>{{ $officeName ?? '—' }}</td></tr>
    @if($position)<tr><td><b>Position</b></td><td>{{ $position }}</td></tr>@endif
    <tr><td><b>Username</b></td><td>{{ $username }}</td></tr>
    <tr><td><b>Email</b></td><td>{{ $email }}</td></tr>
    <tr><td><b>Temporary password</b></td><td><code>{{ $tempPassword }}</code></td></tr>
  </table>
  <p><a href="{{ $loginUrl }}">Sign in here</a></p>
  <p><b>You must change this temporary password the first time you sign in.</b>
     Do not share it, and delete this email after changing your password.</p>
  <p style="color:#64748b;font-size:12px">This is an automated message. If you did not expect it, contact the RDAC administrator.</p>
</body>
</html>