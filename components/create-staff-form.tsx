"use client";

import { useState } from "react";
import { createStaffAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PERMISSION_LABELS, PERMISSIONS, ROLE_LABELS, ROLE_TEMPLATES, type Permission, type Role } from "@/lib/permissions";

const STAFF_ROLES = (Object.keys(ROLE_LABELS) as Role[]).filter((role) => role !== "user");

export function CreateStaffForm({ actorPermissions }: { actorPermissions: string[] }) {
  const canGrant = (permission: string) => actorPermissions.includes(permission);
  const roles = STAFF_ROLES.filter((role) => role !== "founder" || canGrant("platform_ownership"));
  const [role, setRole] = useState<Role>(roles[0] ?? "user_support");
  const [selected, setSelected] = useState<string[]>(ROLE_TEMPLATES[roles[0] ?? "user_support"].filter(canGrant));

  function chooseRole(next: Role) {
    setRole(next);
    setSelected(ROLE_TEMPLATES[next].filter(canGrant));
  }

  return (
    <form action={createStaffAction} className="grid gap-3 border border-rule bg-card p-4">
      <p className="text-sm text-muted">
        The role is a label for the audit log and the sign-in list. Access is whichever boxes you leave checked. You cannot grant a permission you do not hold, and Administrator cannot grant ownership.
      </p>
      <label className="grid gap-1 text-sm">
        Username
        <input className="field" name="username" required placeholder="first.last" />
      </label>
      <label className="grid gap-1 text-sm">
        Name
        <input className="field" name="displayName" required />
      </label>
      <label className="grid gap-1 text-sm">
        Role label
        <select
          className="field"
          name="role"
          value={role}
          onChange={(event) => chooseRole(event.target.value as Role)}
        >
          {roles.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-1 text-sm">
        <legend className="mb-1 font-medium">Permissions to grant</legend>
        {PERMISSIONS.map((permission) => (
          <label key={permission} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="permission"
              value={permission}
              checked={selected.includes(permission)}
              disabled={!canGrant(permission)}
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked ? [...current, permission] : current.filter((item) => item !== permission),
                );
              }}
            />
            <span className={canGrant(permission) ? "" : "text-muted"}>
              {PERMISSION_LABELS[permission as Permission]}
              {permission === "platform_ownership" ? " — founder only" : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 text-sm">
        Reason
        <input className="field" name="reason" required placeholder="Why this account exists" />
      </label>
      <Button type="submit">Create staff account</Button>
    </form>
  );
}
