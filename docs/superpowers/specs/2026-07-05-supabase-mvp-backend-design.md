# Supabase MVP Backend Design

## Goal

Build a backend foundation for Local Way that can start as an MVP and grow into a real travel marketplace service.

## Architecture

The MVP uses Supabase for authentication, PostgreSQL data, file storage, and row-level authorization. The existing `apps/consumer` and `apps/admin` React apps will replace local mock data with Supabase reads and writes. A separate `apps/api` server is deferred until payments, settlement automation, webhooks, or privileged background jobs require server-only secrets.

## Account Model

Every user signs up once as a traveler. A traveler can submit a guide application. When an admin approves the application, the same account receives guide capabilities through `profiles.role = 'guide'` and a matching `guide_profiles` row.

Roles:

- `traveler`: default signed-in user
- `guide`: approved traveler who can create tours
- `admin`: internal operator who can approve guides and manage marketplace data

## Core Data

- `profiles`: public and operational profile data linked to `auth.users`
- `guide_applications`: private guide applications, including verification document paths
- `guide_profiles`: approved guide public profiles
- `tours`: guide-authored tour listings
- `tour_images`: ordered images for each tour
- `reservations`: traveler bookings
- `reviews`: traveler reviews after reservations
- `refunds`: refund workflow records
- `settlements`: guide payout workflow records
- `support_tickets`: traveler and guide support requests
- `notices`: admin-created notices
- `admin_audit_logs`: admin action trail

## File Storage

Storage buckets:

- `avatars`: profile images
- `tour-images`: public tour listing images
- `guide-verification`: private guide application files, including ID images

The `guide-verification` bucket must stay private. The database stores only file paths, never the raw image contents. Admin review screens should use authorized Storage reads or short-lived signed URLs.

## Security

All application tables in the exposed `public` schema use RLS. Policies are ownership-based for traveler and guide records, and admin access is checked through the `profiles.role = 'admin'` row. Authorization must not depend on user-editable metadata.

Storage access is restricted with `storage.objects` policies. Users can upload their own guide verification files under their own user ID folder. Admins can read verification files. Public users can read active tours and visible guide profiles only.

## MVP Flow

1. User signs up through Supabase Auth.
2. A `profiles` row is created with role `traveler`.
3. The user submits a guide application with profile and ID images.
4. Admin reviews the pending application.
5. Approval updates `guide_applications.status`, sets `profiles.role = 'guide'`, and creates `guide_profiles`.
6. The approved guide can create draft and active tours.
7. Travelers can browse active tours and make reservations.

## Current Mock Data Migration

- `apps/admin/src/data/mockData.js` guide requests map to `guide_applications`.
- Admin travelers map to `profiles`.
- Admin guides map to `profiles` plus `guide_profiles`.
- Admin tours and consumer tours map to `tours` plus `tour_images`.
- Admin reservations map to `reservations`.
- Admin reviews map to `reviews`.
- Admin notices map to `notices`.

## Deferred Work

The MVP intentionally defers payment processor integration, automatic ID verification, real-time chat persistence, automated settlements, notification delivery, and server-side webhook handling. These should be added after the core database, storage, auth, and admin approval flows are working.
