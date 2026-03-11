import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium disabled:opacity-50 disabled:pointer-events-none ring-offset-background [transition:transform_0.15s_cubic-bezier(0.34,1.56,0.64,1),box-shadow_0.15s_ease,background-color_0.2s_ease,color_0.2s_ease,border-color_0.2s_ease] active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-elevation-low)] hover:shadow-[var(--shadow-elevation-medium)]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[var(--shadow-elevation-low)] hover:shadow-[var(--shadow-elevation-medium)]',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent/80 hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary',
        glass: 'backdrop-blur-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  // asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
