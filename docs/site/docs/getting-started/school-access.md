---
sidebar_label: Accounts and invitations
description: Set up a school, assign each person a role and classroom, and sign in with a private invitation.
---

# Set up school access

A platform administrator manages schools at `/admin` on the application origin. Each person uses a separate account and signs in at `/account`. A school membership determines their role and access to records. A person can hold more than one membership.

## Onboard a person

1. In **จัดการโรงเรียน**, select the school. For first setup, use **สร้างโรงเรียน**, then **สร้างห้องเรียน** for each class.
2. Use **สร้างบัญชี** to enter the person’s display name. Use their existing account when adding another school, role or class. Check the ID shown with the name when people share a name.
3. Choose **จัดสมาชิกเข้าห้อง**, the account, and its role. Complete the assignment below. Enroll students before linking their guardians.
4. Choose **ออกรหัสเชิญ**, verify the membership and issue a code. Deliver the code privately to that person together with the application’s `/account` URL. Codes can be used once within 15 minutes.
5. After sign-in the person sees their name, school, role and assigned classrooms or children. The session lasts eight hours. People with multiple memberships can switch on the account page. Issue a fresh invitation for a subsequent sign-in.

| Role | Administrator assigns | What the school API authorizes |
| --- | --- | --- |
| Teacher | At least one classroom. Repeat enrollment to add another classroom. | Teacher agents, worksheets, class grades and family report drafts for assigned classes. |
| Student | The classroom where the student takes quizzes. | A student opens the teacher’s quiz link while signed in and submits answers under their own membership. |
| Guardian | The student’s active membership in the same school. Repeat for additional children. | Sent reports for linked children. |
| Principal | The school. | School-level aggregates and approval decisions. |
| Platform administrator | A database operator grants this privilege to a dedicated account. | Setup across schools, including memberships and one-time invitations. |

The [school API guide](../integrations/school-api.md) describes each workflow. The [OpenAPI explorer](../reference/openapi.mdx) includes the admin directory and setup operations.

## Bootstrap the first administrator

After applying the migrations, a trusted database operator creates a **dedicated account for a verified administrator**. The example below runs in `psql`. Supply an existing school UUID and the administrator’s display name. For a fresh installation, insert the first school with `INSERT INTO schools (name) VALUES (...) RETURNING id` and use that ID.

```sql
\prompt 'School UUID: ' school_id
\prompt 'Administrator name: ' admin_name
BEGIN;
INSERT INTO school_accounts (display_name) VALUES (:'admin_name')
  RETURNING id AS admin_account_id \gset
INSERT INTO school_memberships (school_id, owner_id, role)
  VALUES (:'school_id', :'admin_account_id', 'principal')
  RETURNING id AS admin_membership_id \gset
INSERT INTO platform_admins (account_id) VALUES (:'admin_account_id');
COMMIT;
\echo Membership ID: :admin_membership_id
```

With `DATABASE_URL` configured, the operator issues a private administrator invitation using the membership UUID printed above.

```sh
node apps/api/scripts/issue-school-invite.mjs <membership-uuid> <new-private-file>
```

Use the same operator tool for future administrator sign-ins. Ordinary school invitations can be issued in the page. The platform grant applies across all memberships of its account. Removing its row from `platform_admins` revokes administrative access on subsequent requests. Use a dedicated operator identity rather than granting a shared demo account this privilege.
