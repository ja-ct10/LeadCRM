/** Shared text roles. Keep compact typography local to small viewports and respect density. */
export const responsiveTypography = {
  title: 'text-xl [@media(max-width:360px)]:text-lg',
  body: 'text-sm [@media(max-width:360px)]:text-xs',
  control: 'text-sm [@media(max-width:360px)]:text-xs',
  largeAction: 'text-base [@media(max-width:360px)]:text-sm',
  authTitle: 'text-3xl [@media(max-width:360px)]:text-2xl',
} as const;
