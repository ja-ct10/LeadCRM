# LeadCRM design resources

Use [the card API and examples](../frontend/src/shared/components/ui/CARD-COMPONENTS.md) for component props, responsive grids, tokens, accessibility, testing and migration. [Card visual specifications](CARD-VISUAL-SPECS.md) retain measurements; [MASTER](MASTER.md) defines the overall design system. The live `/card-showcase` route and [showcase source](../frontend/src/features/tenant/pages/card-showcase-page.tsx) remain maintained examples.

The original August 2026 samples informed StatCard (Payrolls Cost: value and subtitle), InfoCard (Payroll Overview: description and link), and vertical FeatureCard/ColoredBorderCard feature grids. StatCard supports dashboard metrics and variant colors; MetricCard provides compact activity metrics and a chart placeholder. Horizontal FeatureCard suits a list; vertical suits a grid. Base Card supports custom composition.

Use shared theme tokens and dark variants, stable keys, keyboard focus, reduced motion and labels. Validate light/dark behavior and responsive bounds before shipping a change. Extend the existing components, update the canonical API and showcase together, and verify their consumers. The former index, quick-reference and implementation-summary documents repeated this guidance and are consolidated here. Historical Git revisions retain those drafts.
