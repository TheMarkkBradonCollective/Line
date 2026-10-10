import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Group photo, or a teal tile with the group's initials. */
export function GroupPhoto({ name, src, size = "md" }: { name: string; src: string | null; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-20 w-20 rounded-[24px] text-2xl" : size === "sm" ? "h-9 w-9 rounded-xl text-[12px]" : "h-12 w-12 rounded-2xl text-[15px]";
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#14b8a6] to-[#0f766e] font-bold text-white", box)} aria-hidden>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials || <Users className="h-5 w-5" />}
    </span>
  );
}
