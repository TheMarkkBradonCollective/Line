/**
 * Staff access is a row in the permissions table.
 * ROLE_TEMPLATES is only the seed checklist for a new account.
 * Request handling must call hasPermission(), never "if role === …".
 */

export const PERMISSIONS = [
  "view_user_account",
  "view_reported_content",
  "review_reports",
  "moderate_content",
  "restrict_accounts",
  "suspend_accounts",
  "manage_support_tickets",
  "manage_staff",
  "create_staff_accounts",
  "modify_roles",
  "modify_permissions",
  "access_audit_logs",
  "manage_platform_settings",
  "manage_security_settings",
  "manage_financial_settings",
  "access_emergency_controls",
  "platform_ownership",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_user_account: "View user account",
  view_reported_content: "View reported content",
  review_reports: "Review reports",
  moderate_content: "Moderate content",
  restrict_accounts: "Restrict accounts",
  suspend_accounts: "Suspend accounts",
  manage_support_tickets: "Manage support tickets",
  manage_staff: "Manage staff",
  create_staff_accounts: "Create staff accounts",
  modify_roles: "Modify roles",
  modify_permissions: "Modify permissions",
  access_audit_logs: "Access audit logs",
  manage_platform_settings: "Manage platform settings",
  manage_security_settings: "Manage security settings",
  manage_financial_settings: "Manage financial settings",
  access_emergency_controls: "Access emergency controls",
  platform_ownership: "Platform ownership",
};

export const ROLES = [
  "user",
  "user_support",
  "moderator",
  "senior_moderator",
  "manager",
  "director",
  "administrator",
  "founder",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  user_support: "User Support",
  moderator: "Moderator",
  senior_moderator: "Senior Moderator",
  manager: "Manager",
  director: "Director",
  administrator: "Administrator",
  founder: "Founder",
};

/** Escalation order. Administrator is privileged staff, not the owner. Founder sits above that seat. */
export const ESCALATION_LADDER = [
  "moderator",
  "senior_moderator",
  "manager",
  "director",
  "administrator",
  "founder",
] as const;

export type Queue = (typeof ESCALATION_LADDER)[number];

const SUPPORT: Permission[] = [
  "view_user_account",
  "view_reported_content",
  "manage_support_tickets",
];

const MODERATOR: Permission[] = [
  "view_user_account",
  "view_reported_content",
  "review_reports",
  "moderate_content",
];

const SENIOR: Permission[] = [...MODERATOR, "restrict_accounts"];

const MANAGER: Permission[] = [
  ...SENIOR,
  "suspend_accounts",
  "manage_support_tickets",
  "access_audit_logs",
];

const DIRECTOR: Permission[] = [...MANAGER, "manage_staff", "manage_platform_settings"];

/** Administrator does not receive platform_ownership. */
const ADMINISTRATOR: Permission[] = [
  ...DIRECTOR,
  "create_staff_accounts",
  "modify_roles",
  "modify_permissions",
  "manage_security_settings",
  "manage_financial_settings",
  "access_emergency_controls",
];

const FOUNDER: Permission[] = [...ADMINISTRATOR, "platform_ownership"];

export const ROLE_TEMPLATES: Record<Role, Permission[]> = {
  user: [],
  user_support: SUPPORT,
  moderator: MODERATOR,
  senior_moderator: SENIOR,
  manager: MANAGER,
  director: DIRECTOR,
  administrator: ADMINISTRATOR,
  founder: FOUNDER,
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Which report queues a person can open.
 * Derived from permission grants, so a title with no matching grant sees nothing.
 */
export function queuesForPermissions(perms: readonly string[]): Queue[] {
  const has = (permission: Permission) => perms.includes(permission);
  const queues: Queue[] = [];
  if (has("review_reports")) queues.push("moderator");
  if (has("restrict_accounts")) queues.push("senior_moderator");
  if (has("suspend_accounts")) queues.push("manager");
  if (has("manage_platform_settings")) queues.push("director");
  if (has("access_emergency_controls")) queues.push("administrator");
  if (has("platform_ownership")) queues.push("founder");
  return queues;
}
