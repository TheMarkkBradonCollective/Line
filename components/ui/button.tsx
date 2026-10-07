import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-on shadow-glow hover:bg-brand-deep hover:text-white",
        stamp: "bg-brand text-brand-on shadow-glow hover:bg-brand-deep hover:text-white",
        pine: "bg-brand text-brand-on hover:bg-brand-deep hover:text-white",
        outline: "border border-line bg-surface text-ink hover:border-brand hover:text-brand-strong",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        soft: "bg-brand-soft text-brand-strong hover:bg-brand-tint",
        danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        default: "h-11 px-5 text-[15px]",
        sm: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
