import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-pine text-white hover:bg-pine-deep",
        stamp: "bg-pine text-white hover:bg-pine-deep",
        pine: "bg-pine text-white hover:bg-pine-deep",
        outline: "border border-[#d0d0d0] bg-white text-ink hover:border-pine hover:text-pine",
        ghost: "text-ink hover:bg-[#f3f3f3] hover:text-pine",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
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
