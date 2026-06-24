# Additional environment variables

Set these on the backend host before enabling email delivery:

- `SENDGRID_API_KEY`: SendGrid API key with Mail Send permissions.
- `SENDGRID_FROM_EMAIL`: verified sender email address used as the default From address.

Optional per-event settings can override the sender display name, reply-to email, and subject through `event.settings.emailFromName`, `event.settings.emailReplyTo`, and `event.settings.emailSubject`.
