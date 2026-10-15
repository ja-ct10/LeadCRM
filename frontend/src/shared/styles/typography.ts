/** Shared text roles. Keep compact typography local to small viewports and respect density. */
export const responsiveTypography = {
  title: 'text-xl max-[360px]:text-lg',
  body: 'text-sm max-[360px]:text-xs',
  control: 'text-sm max-[360px]:text-xs',
  largeAction: 'text-base max-[360px]:text-sm',
  authTitle: 'text-3xl max-[360px]:text-2xl',
} as const;
