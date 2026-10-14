import React from 'react';
import { Button } from './UI';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  children,
  isLoading,
  loadingText = 'Processing...',
  ...props
}) => {
  return (
    <Button
      {...props}
      isLoading={isLoading}
      disabled={isLoading || props.disabled}
    >
      {isLoading ? loadingText : children}
    </Button>
  );
};
