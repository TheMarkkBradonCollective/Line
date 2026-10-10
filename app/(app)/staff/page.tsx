import Link from "next/link";
import { redirect } from "next/navigation";
import {
  escalateAction,
  hideAction,
  permissionsAction,
  resolveAction,
  restoreAction,
  restrictAction,
  roleAction,
  settingAction,
  suspendAction,
  ticketStatusAction,
} from "@/app/actions";
import { CreateStaffForm } from "@/components/create-staff-form";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  ROLE_LABELS,
  queuesForPermissions,
  type Permission,
  type Role,
} from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { getPost, getSetting, listPermissions } from "@/lib/social";
import {
  listAudit,
  listReports,
  listResolvedReports,
  listStaff,
  listTickets,
  searchAccounts,
} from "@/lib/staff";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; q?: string; post?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const query = await searchParams;
  const db = getDb();
  const grants = await listPermissions(db, user.id);
  const has = (permission: Permission) => grants.includes(permission);
  const queues = queuesForPermissions(grants);

  if (grants.length === 0) {
    return (
      <div className="px-4 pt-5 md:px-0 md:pt-6">
        <p className="kicker">Staff</p>
        <h1 className="mt-1 page-title">This desk is closed.</h1>
        <p className="mt-2 text-sm text-muted">
          {ROLE_LABELS[user.role as Role] ?? user.role} is a label. You have no staff permissions, so none of the tools open.
        </p>
      </div>
    );
  }

  const accounts = has("view_user_account") ? await searchAccounts(db, user, query.q || "") : [];
  const reports = has("review_reports") || queues.length ? await listReports(db, user) : [];
  const reportPosts = new Map(
    await Promise.all(
      reports
        .filter((report) => report.targetType === "post" || report.targetType === "video")
        .map(async (report) => [report.id, await getPost(db, report.targetId)] as const),
    ),
  );
  const resolved = await listResolvedReports(db, user);
  const tickets = has("manage_support_tickets") ? await listTickets(db, user) : [];
  const staff = has("manage_staff") ? await listStaff(db, user) : [];
  const audit = has("access_audit_logs") ? await listAudit(db, user) : [];
  const lookupId = Number(query.post || "");
  const lookedUp = has("view_reported_content") && lookupId ? await getPost(db, lookupId) : null;

  return (
    <div className="grid gap-8 px-4 pb-6 pt-5 md:px-0 md:pt-6">
      <div>
        <p className="kicker">Staff</p>
        <h1 className="mt-1 page-title">Desk</h1>
        <p className="mt-2 text-sm">
          Signed in as {user.displayName}. The label on the account is {ROLE_LABELS[user.role as Role] ?? user.role}. Tools below open only where a permission is granted.
        </p>
        <p className="mt-2 text-sm text-muted">
          Escalation runs Moderator → Senior Moderator → Manager → Director → Administrator or Founder. Administrator is not the owner.
        </p>
        <div className="mt-4">
          <Notice notice={query.notice} error={query.error} />
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold tracking-tight">Grants</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {PERMISSIONS.map((permission) => (
            <li key={permission} className={has(permission) ? "" : "text-muted"}>
              {has(permission) ? "Open" : "Closed"} · {PERMISSION_LABELS[permission]}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Report queues you can open: {queues.length ? queues.join(", ") : "none"}.</p>
      </section>

      {has("view_user_account") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Accounts</h2>
          <form className="flex gap-2" action="/staff">
            <input className="field" name="q" defaultValue={query.q || ""} placeholder="Name or username" aria-label="Search accounts" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <ul className="grid gap-2">
            {accounts.map(({ user: account, permissions }) => (
              <li key={account.id} className="rounded-2xl border border-line/70 bg-surface px-3 py-3 text-sm">
                <p className="font-medium">
                  {account.displayName} <span className="font-normal text-muted">@{account.username}</span>
                </p>
                <p className="text-muted">
                  {ROLE_LABELS[account.role as Role] ?? account.role}
                  {account.restricted ? " · restricted" : ""}
                  {account.suspended ? " · suspended" : ""}
                </p>
                <p className="mt-1 text-xs text-muted">{permissions.length ? permissions.join(", ") : "No staff grants"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link className="underline" href={`/u/${account.username}`}>Profile</Link>
                  {has("restrict_accounts") ? (
                    <InlineReason
                      action={restrictAction}
                      fields={{ userId: String(account.id), restricted: account.restricted ? "0" : "1" }}
                      label={account.restricted ? "Lift restriction" : "Restrict"}
                    />
                  ) : null}
                  {has("suspend_accounts") ? (
                    <InlineReason
                      action={suspendAction}
                      fields={{ userId: String(account.id), suspended: account.suspended ? "0" : "1" }}
                      label={account.suspended ? "Restore account" : "Suspend"}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {has("view_reported_content") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Reported content</h2>
          <p className="text-sm text-muted">Looking up a post does not put it on your timeline.</p>
          <form className="flex gap-2" action="/staff">
            <input className="field" name="post" placeholder="Post id" aria-label="Post id" />
            <Button type="submit" variant="outline">Open case content</Button>
          </form>
          {query.post && !lookedUp ? <p className="text-sm">No post with that id.</p> : null}
          {lookedUp ? (
            <article className="rounded-2xl border border-line/70 bg-surface p-3 text-sm">
              <p className="kicker">Case content · post {lookedUp.id}</p>
              <p className="mt-2 whitespace-pre-wrap">{lookedUp.body}</p>
              <p className="mt-2 text-muted">{lookedUp.hidden ? `Hidden. ${lookedUp.hiddenReason ?? ""}` : "Visible where it was shared or listed."}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {has("moderate_content") && !lookedUp.hidden ? (
                  <InlineReason action={hideAction} fields={{ postId: String(lookedUp.id) }} label="Hide" />
                ) : null}
                {has("moderate_content") && lookedUp.hidden ? (
                  <InlineReason action={restoreAction} fields={{ postId: String(lookedUp.id) }} label="Restore" />
                ) : null}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {queues.length ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Report queue</h2>
          <p className="text-sm text-muted">Cases in queues your grants open. This is not a feed.</p>
          {reports.length === 0 ? <p className="text-sm">Nothing waiting in your queues.</p> : null}
          {reports.map((report) => {
            const post = reportPosts.get(report.id) ?? null;
            return (
              <article key={report.id} className="rounded-2xl border border-line/70 bg-surface p-3 text-sm">
                <p className="kicker">Case {report.id} · {report.queue} · {report.category}</p>
                <h3 className="mt-1 font-medium">{report.targetLabel}</h3>
                <p className="text-muted">Filed by {report.reporterName} · {formatWhen(report.createdAt)} · {report.targetType}</p>
                {report.details ? <p className="mt-2">{report.details}</p> : null}
                {post && has("view_reported_content") ? <p className="mt-2 border-t border-rule pt-2">{post.body}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.queue === "director" ? (
                    <>
                      <InlineReason action={escalateAction} fields={{ reportId: String(report.id), toQueue: "administrator" }} label="Escalate to Administrator" />
                      <InlineReason action={escalateAction} fields={{ reportId: String(report.id), toQueue: "founder" }} label="Escalate to Founder" />
                    </>
                  ) : report.queue === "administrator" ? (
                    <InlineReason action={escalateAction} fields={{ reportId: String(report.id), toQueue: "founder" }} label="Escalate to Founder" />
                  ) : report.queue === "founder" ? null : (
                    <InlineReason action={escalateAction} fields={{ reportId: String(report.id) }} label={`Escalate`} />
                  )}
                  <InlineReason action={resolveAction} fields={{ reportId: String(report.id) }} label="Resolve" />
                  {post && has("moderate_content") ? (
                    <InlineReason action={post.hidden ? restoreAction : hideAction} fields={{ postId: String(post.id) }} label={post.hidden ? "Restore post" : "Hide post"} />
                  ) : null}
                </div>
              </article>
            );
          })}
          {resolved.length ? (
            <div>
              <h3 className="font-medium">Recently resolved</h3>
              <ul className="mt-1 grid gap-1 text-sm text-muted">
                {resolved.map((report) => (
                  <li key={report.id}>#{report.id} {report.targetLabel} — {report.resolution}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {has("manage_support_tickets") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Tickets</h2>
          <p className="text-sm text-muted">A short list for support. Not a full ticket CRM, and not a timeline.</p>
          {tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-2xl border border-line/70 bg-surface p-3 text-sm">
              <p className="font-medium">{ticket.subject}</p>
              <p className="text-muted">{ticket.user_name} @{ticket.username} · {ticket.status} · {formatWhen(ticket.created_at)}</p>
              <p className="mt-2">{ticket.body}</p>
              <form action={ticketStatusAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <select className="field max-w-[10rem]" name="status" defaultValue={ticket.status} aria-label="Ticket status">
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
                <input className="field max-w-xs" name="reason" placeholder="Reason" required aria-label="Reason" />
                <Button type="submit" size="sm" variant="outline">Update</Button>
              </form>
            </article>
          ))}
        </section>
      ) : null}

      {has("manage_staff") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Staff directory</h2>
          <ul className="grid gap-2 text-sm">
            {staff.map(({ user: member, permissions }) => (
              <li key={member.id} className="rounded-2xl border border-line/70 bg-surface px-3 py-2">
                <p className="font-medium">{member.displayName} · {ROLE_LABELS[member.role as Role] ?? member.role}</p>
                <p className="text-muted">{permissions.join(", ") || "No grants"}</p>
                {has("modify_roles") ? (
                  <form action={roleAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <select className="field max-w-[14rem]" name="role" defaultValue={member.role} aria-label="Role label">
                      {(Object.keys(ROLE_LABELS) as Role[])
                        .filter((role) => role !== "founder" || has("platform_ownership"))
                        .map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                    </select>
                    <input className="field max-w-xs" name="reason" placeholder="Reason" required aria-label="Reason" />
                    <Button type="submit" size="sm" variant="outline">Change label</Button>
                  </form>
                ) : null}
                {has("modify_permissions") ? (
                  <form action={permissionsAction} className="mt-2 grid gap-1">
                    <input type="hidden" name="userId" value={member.id} />
                    {PERMISSIONS.map((permission) => (
                      <label key={permission} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="permission"
                          value={permission}
                          defaultChecked={permissions.includes(permission)}
                          disabled={!has(permission)}
                        />
                        {PERMISSION_LABELS[permission]}
                      </label>
                    ))}
                    <input className="field" name="reason" placeholder="Reason for this grant change" required />
                    <Button type="submit" size="sm">Replace grants</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {has("create_staff_accounts") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Create a staff account</h2>
          <CreateStaffForm actorPermissions={grants} />
        </section>
      ) : null}

      {has("manage_platform_settings") ? (
        <SettingBlock
          title="Platform"
          note="Tagline and signups. Nothing here delivers a post."
          fields={[
            ["site_tagline", "Tagline", await getSetting(db, "site_tagline")],
            ["signups_open", "Signups open (1 or 0)", await getSetting(db, "signups_open")],
          ]}
        />
      ) : null}

      {has("manage_security_settings") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Security</h2>
          <p className="text-sm text-muted">
            Sign-in is email and password through Supabase Auth. Email confirmation and redirect URLs are set in the Supabase dashboard. Staff actions always ask for a reason ({await getSetting(db, "staff_reason_required") === "1" ? "on" : "off"}).
          </p>
          <SettingForm settingKey="security_note" label="Security note" value={await getSetting(db, "security_note")} />
        </section>
      ) : null}

      {has("manage_financial_settings") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Financial</h2>
          <p className="border border-rule bg-surface-2 px-3 py-2 text-sm">
            LINE has no payments. Nothing here charges a card, pays a creator, or opens an invoice.
          </p>
          <SettingForm settingKey="billing_note" label="Billing note" value={await getSetting(db, "billing_note")} />
        </section>
      ) : null}

      {has("access_emergency_controls") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Emergency</h2>
          <p className="text-sm">Sharing is {await getSetting(db, "sharing_paused") === "1" ? "paused" : "open"}.</p>
          <SettingForm
            settingKey="sharing_paused"
            label="Pause sharing (1 pauses, 0 resumes)"
            value={await getSetting(db, "sharing_paused")}
          />
        </section>
      ) : null}

      {has("platform_ownership") ? (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">Ownership</h2>
          <p className="text-sm">
            This panel exists only with the platform ownership grant. Administrator does not have it. Founder is the ownership seat, not a normal staff account.
          </p>
          <SettingForm settingKey="ownership_note" label="Ownership note" value={await getSetting(db, "ownership_note")} />
        </section>
      ) : null}

      {has("access_audit_logs") ? (
        <section className="grid gap-2">
          <h2 className="font-display text-xl font-bold tracking-tight">Audit log</h2>
          <p className="text-sm text-muted">Append-only. Staff cannot erase or rewrite their own history. There is no delete control.</p>
          <div className="overflow-x-auto border border-rule">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-card">
                <tr>
                  {["Staff", "Role", "Action", "Affected", "When", "Reason", "Previous", "New", "Case"].map((heading) => (
                    <th key={heading} className="border-b border-rule px-2 py-2 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="border-b border-rule px-2 py-2">{row.staff_name}</td>
                    <td className="border-b border-rule px-2 py-2">{row.staff_role}</td>
                    <td className="border-b border-rule px-2 py-2">{row.action}</td>
                    <td className="border-b border-rule px-2 py-2">{row.target_type} {row.target_id ?? ""}</td>
                    <td className="border-b border-rule px-2 py-2">{formatWhen(row.created_at)}</td>
                    <td className="border-b border-rule px-2 py-2">{row.reason}</td>
                    <td className="border-b border-rule px-2 py-2">{row.previous_state}</td>
                    <td className="border-b border-rule px-2 py-2">{row.new_state}</td>
                    <td className="border-b border-rule px-2 py-2">{row.case_id ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SettingBlock({
  title,
  note,
  fields,
}: {
  title: string;
  note: string;
  fields: [string, string, string][];
}) {
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted">{note}</p>
      {fields.map(([key, label, value]) => (
        <SettingForm key={key} settingKey={key} label={label} value={value} />
      ))}
    </section>
  );
}

function SettingForm({ settingKey, label, value }: { settingKey: string; label: string; value: string }) {
  return (
    <form action={settingAction} className="grid gap-2 rounded-2xl border border-line/70 bg-surface p-3 text-sm">
      <input type="hidden" name="key" value={settingKey} />
      <label className="grid gap-1">
        {label}
        <input className="field" name="value" defaultValue={value} />
      </label>
      <input className="field" name="reason" placeholder="Reason" required aria-label="Reason" />
      <Button type="submit" size="sm" variant="outline">Save</Button>
    </form>
  );
}

function InlineReason({
  action,
  fields,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input className="field max-w-[14rem]" name="reason" placeholder="Reason" required aria-label="Reason" />
      <Button type="submit" size="sm" variant="outline">{label}</Button>
    </form>
  );
}
