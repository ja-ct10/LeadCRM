# LeadCRM Card Component System

Complete card component library following LeadCRM design system specifications. All components include full dark mode support, accessibility features, and responsive design.

## Table of Contents

1. [Base Card Component](#base-card-component)
2. [Stat Card](#stat-card)
3. [Info Card](#info-card)
4. [Feature Card](#feature-card)
5. [Pricing Card](#pricing-card)
6. [Colored Border Card](#colored-border-card)
7. [Metric Card](#metric-card)
8. [Design Tokens](#design-tokens)
9. [Usage Examples](#usage-examples)

---

## Base Card Component

The foundation component for all card variants. Provides consistent styling, animations, and hover effects.

### Props

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean; // Enables hover lift effect
  variant?: "default" | "outlined" | "elevated" | "glass";
}
```

### Variants

- **default**: Standard card with subtle shadow and backdrop blur
- **outlined**: Border-focused with transparent background
- **elevated**: Strong shadow for hierarchy emphasis
- **glass**: Glassmorphism effect with blur

### Example

```tsx
import { Card } from "@/shared/components/ui/card";

<Card hoverable variant="elevated" className="p-6">
  <h3>Custom Content</h3>
</Card>;
```

---

## Stat Card

Perfect for dashboard metrics, KPIs, and statistical displays. Inspired by the "Payrolls Cost" design sample.

### Props

```typescript
interface StatCardProps {
  title: string; // Metric label
  value: string | number; // Main value
  subtitle?: string; // Additional context
  icon?: LucideIcon; // Optional icon
  trend?: {
    value: string; // e.g., "+12.5%"
    direction: "up" | "down" | "neutral";
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}
```

### Color Variants

- `default`: White/transparent background
- `primary`: Blue accent
- `success`: Green accent
- `warning`: Amber accent
- `danger`: Red accent

### Example

```tsx
import { StatCard } from "@/shared/components/ui/card";
import { DollarSign } from "lucide-react";

<StatCard
  title="Total Revenue"
  value="$45,231"
  subtitle="last month"
  icon={DollarSign}
  trend={{ value: "+12.5%", direction: "up" }}
  variant="success"
/>;
```

### Use Cases

- Dashboard KPIs
- Financial metrics
- User analytics
- Performance indicators
- Real-time statistics

---

## Info Card

Large informational cards with title, description, and call-to-action. Inspired by the "Payroll Overview" design sample.

### Props

```typescript
interface InfoCardProps {
  title: string;
  description: string;
  linkText?: string; // CTA text (default: "Learn more")
  onLinkClick?: () => void; // Click handler
  icon?: LucideIcon;
  className?: string;
}
```

### Example

```tsx
import { InfoCard } from "@/shared/components/ui/card";
import { Target } from "lucide-react";

<InfoCard
  icon={Target}
  title="Payroll Overview"
  description="Get detailed descriptions about Payrolls Cost, Total Expense, Pending Payments, and Total Payrolls in your dashboard."
  linkText="Learn more"
  onLinkClick={() => navigate("/payroll")}
/>;
```

### Use Cases

- Feature explanations
- Onboarding cards
- Documentation links
- Help sections
- Product tours

---

## Feature Card

Flexible card for features and benefits. Available in horizontal and vertical layouts.

### Props

```typescript
interface FeatureCardProps {
  icon: LucideIcon;
  iconColor?: string; // Tailwind color class
  iconBgColor?: string; // Background color class
  title: string;
  description: string;
  onClick?: () => void; // Makes card clickable
  variant?: "horizontal" | "vertical";
}
```

### Horizontal Variant

Ideal for list-style layouts with icon on the left.

```tsx
<FeatureCard
  icon={Users}
  iconColor="text-blue-600"
  iconBgColor="bg-blue-50 dark:bg-blue-950/20"
  title="Lead Management"
  description="Organize and track all your leads in one centralized platform with smart segmentation."
  variant="horizontal"
  onClick={() => navigate("/leads")}
/>
```

### Vertical Variant

Perfect for grid layouts with icon on top. Inspired by the grid card design samples.

```tsx
<FeatureCard
  icon={Clock}
  iconColor="text-orange-600"
  iconBgColor="bg-orange-50 dark:bg-orange-950/20"
  title="Save Time with Automation"
  description="Automate repetitive tasks and workflows to focus on what matters most."
  variant="vertical"
/>
```

### Recommended Color Combinations

```tsx
// Blue (Primary)
iconColor = "text-blue-600";
iconBgColor = "bg-blue-50 dark:bg-blue-950/20";

// Purple (Automation)
iconColor = "text-purple-600";
iconBgColor = "bg-purple-50 dark:bg-purple-950/20";

// Green (Success/Growth)
iconColor = "text-green-600";
iconBgColor = "bg-green-50 dark:bg-green-950/20";

// Orange (Action/Speed)
iconColor = "text-orange-600";
iconBgColor = "bg-orange-50 dark:bg-orange-950/20";

// Pink (Engagement)
iconColor = "text-pink-600";
iconBgColor = "bg-pink-50 dark:bg-pink-950/20";
```

### Use Cases

- Feature highlights
- Benefits lists
- Service offerings
- Product capabilities
- Marketing pages

---

## Pricing Card

Pricing plan display with features list and CTA button.

### Props

```typescript
interface PricingCardProps {
  name: string; // Plan name
  price: string; // Price value
  period: string; // "/month", "/year", etc.
  features: string[]; // Feature list
  highlighted?: boolean; // Makes card stand out
  badgeText?: string; // Top badge (e.g., "Best Value")
  onSelect?: () => void; // Selection handler
}
```

### Example

```tsx
<PricingCard
  name="Professional"
  price="$79"
  period="/month"
  features={[
    "Unlimited contacts",
    "Workflow automation",
    "Batch messaging",
    "Priority support",
    "Custom dashboards",
    "Asset tracking",
  ]}
  highlighted
  badgeText="Best Value"
  onSelect={() => handleSelectPlan("professional")}
/>
```

### Design Features

- Checkmark icons for features
- Highlighted variant with blue accent
- Top badge for callouts
- Consistent CTA button
- Center-aligned layout

### Use Cases

- Pricing pages
- Plan comparison
- Subscription tiers
- Package offerings
- Upgrade prompts

---

## Colored Border Card

Feature cards with colored top border accent. Inspired by the grid card design samples.

### Props

```typescript
interface ColoredBorderCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  borderColor?: string; // Border color class
  iconColor?: string;
  iconBgColor?: string;
  onClick?: () => void;
}
```

### Example

```tsx
<ColoredBorderCard
  icon={Clock}
  title="Save Time with Automation"
  description="Automate repetitive tasks and workflows to focus on what matters most."
  borderColor="border-t-orange-500"
  iconColor="text-orange-600"
  iconBgColor="bg-orange-50 dark:bg-orange-950/20"
/>
```

### Recommended Color Sets

```tsx
// Blue
borderColor = "border-t-blue-500";
iconColor = "text-blue-600";
iconBgColor = "bg-blue-50 dark:bg-blue-950/20";

// Purple
borderColor = "border-t-purple-500";
iconColor = "text-purple-600";
iconBgColor = "bg-purple-50 dark:bg-purple-950/20";

// Green
borderColor = "border-t-green-500";
iconColor = "text-green-600";
iconBgColor = "bg-green-50 dark:bg-green-950/20";

// Orange
borderColor = "border-t-orange-500";
iconColor = "text-orange-600";
iconBgColor = "bg-orange-50 dark:bg-orange-950/20";

// Pink
borderColor = "border-t-pink-500";
iconColor = "text-pink-600";
iconBgColor = "bg-pink-50 dark:bg-pink-950/20";
```

### Use Cases

- Feature grids
- Category displays
- Service types
- Benefit lists
- Module showcases

---

## Metric Card

Compact metric display with optional trend indicator and chart placeholder.

### Props

```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string; // e.g., "12%"
    direction: "up" | "down";
  };
  chart?: React.ReactNode; // Optional chart component
}
```

### Example

```tsx
<MetricCard
  title="Total Calls"
  value="1,234"
  change={{ value: "12%", direction: "up" }}
  chart={<MiniLineChart data={callData} />}
/>
```

### Design Features

- Compact layout
- Trend pill badge
- Color-coded direction (green up, red down)
- Optional chart area
- Clean typography hierarchy

### Use Cases

- Dashboard widgets
- Activity metrics
- Performance tracking
- Quick stats
- Overview panels

---

## Design Tokens

All cards follow these design standards:

### Spacing

```tsx
p - 6; // Standard card padding
p - 8; // Large card padding (InfoCard, PricingCard)
gap - 4; // Standard content gaps
gap - 6; // Large section gaps
```

### Border Radius

```tsx
rounded-2xl   // All cards
rounded-xl    // Buttons, icon containers
rounded-lg    // Icon backgrounds
```

### Shadows

```tsx
shadow-lg     // Standard elevation
shadow-xl     // Elevated variant
shadow-2xl    // Glass variant, modals
```

### Colors

```tsx
// Backgrounds
bg-white dark:bg-white/[0.02]              // Card background
bg-slate-50 dark:bg-slate-950/20           // Subtle surface

// Borders
border-gray-200 dark:border-white/[0.05]   // Card border
border-white/20 dark:border-white/[0.05]   // Glass border

// Text
text-slate-900 dark:text-white             // Primary text
text-slate-600 dark:text-slate-400         // Secondary text
text-slate-500 dark:text-slate-400         // Tertiary text
```

### Typography

```tsx
// Titles
font-display                               // For card titles
text-2xl font-bold                         // InfoCard title
text-lg font-bold                          // FeatureCard title
text-4xl font-bold                         // StatCard value

// Body
text-sm                                    // Standard body text
text-xs                                    // Small labels
```

---

## Usage Examples

### Dashboard Layout

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard title="Revenue" value="$45,231" icon={DollarSign} />
  <StatCard title="Users" value="2,342" icon={Users} />
  <StatCard title="Conversion" value="3.24%" icon={TrendingUp} />
  <StatCard title="Response" value="2.4h" icon={Clock} />
</div>
```

### Feature Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {features.map((feature) => (
    <FeatureCard
      key={feature.id}
      icon={feature.icon}
      title={feature.title}
      description={feature.description}
      variant="vertical"
    />
  ))}
</div>
```

### Pricing Table

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <PricingCard name="Starter" price="$29" period="/month" features={[...]} />
  <PricingCard name="Pro" price="$79" period="/month" features={[...]} highlighted badgeText="Best Value" />
  <PricingCard name="Enterprise" price="$199" period="/month" features={[...]} />
</div>
```

### Mixed Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    <InfoCard
      title="Enterprise Security"
      description="Bank-level encryption..."
      icon={Shield}
    />
  </div>
  <div className="space-y-6">
    <StatCard title="Uptime" value="99.9%" icon={Shield} />
    <StatCard title="Response" value="< 1h" icon={MessageSquare} />
  </div>
</div>
```

### Animated Grid Entry

```tsx
import { motion } from "motion/react";

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {items.map((item, index) => (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
    >
      <FeatureCard {...item} />
    </motion.div>
  ))}
</div>;
```

---

## Accessibility

All card components include:

- ✅ Semantic HTML structure
- ✅ Proper heading hierarchy
- ✅ ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Focus states (via Tailwind)
- ✅ Color contrast WCAG AA compliant
- ✅ Reduced motion support

### Focus States

All interactive elements include visible focus states:

```tsx
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

### Screen Reader Support

```tsx
aria-label="Start free trial"              // Buttons
role="button"                               // Clickable cards
tabIndex={0}                                // Keyboard navigation
```

---

## Performance

### Optimization Tips

1. **Use `motion.div` only when animation is needed**
   - Non-animated cards can use regular `<div>`

2. **Lazy load icons**

   ```tsx
   import dynamic from "next/dynamic";
   const Icon = dynamic(() => import("lucide-react").then((mod) => mod.Users));
   ```

3. **Memoize card grids**

   ```tsx
   const cards = useMemo(
     () => data.map((item) => <FeatureCard key={item.id} {...item} />),
     [data],
   );
   ```

4. **Virtualize long lists**
   - For 50+ cards, use `react-window` or `react-virtualized`

---

## Testing

### Component Tests

```tsx
import { render, screen } from "@testing-library/react";
import { StatCard } from "./card";

test("renders stat card with value", () => {
  render(<StatCard title="Revenue" value="$45,231" />);
  expect(screen.getByText("$45,231")).toBeInTheDocument();
});

test("shows trend indicator", () => {
  render(
    <StatCard
      title="Users"
      value="1,234"
      trend={{ value: "+12%", direction: "up" }}
    />,
  );
  expect(screen.getByText("+12%")).toHaveClass("text-emerald-500");
});
```

---

## Migration Guide

### From Old Card System

```tsx
// OLD
<div className="card">
  <h3>{title}</h3>
  <p>{description}</p>
</div>

// NEW
<Card className="p-6">
  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
    {title}
  </h3>
  <p className="text-sm text-slate-600 dark:text-slate-400">
    {description}
  </p>
</Card>
```

### Common Patterns

| Old Pattern          | New Component                          |
| -------------------- | -------------------------------------- |
| Dashboard metric div | `<StatCard />`                         |
| Feature list item    | `<FeatureCard variant="horizontal" />` |
| Benefit grid card    | `<FeatureCard variant="vertical" />`   |
| Info box             | `<InfoCard />`                         |
| Pricing tier         | `<PricingCard />`                      |

---

## Live Demo

Visit `/card-showcase` in your development environment to see all components in action with interactive examples and code snippets.

---

## Support

For questions or issues:

- Check design system: `.kiro/skills/leadcrm-design-system.md`
- View showcase: `http://localhost:3000/card-showcase`
- Frontend patterns: `.kiro/skills/frontend-patterns`

---

**Last Updated:** August 10, 2026  
**Version:** 1.0.0  
**Maintained by:** LeadCRM Design Team
