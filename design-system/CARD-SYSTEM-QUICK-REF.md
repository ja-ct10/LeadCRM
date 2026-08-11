# Card Component System — Quick Reference

> 🎨 Complete card library based on provided design samples  
> 📦 Import: `@/shared/components/ui/card`  
> 🎯 Demo: `/card-showcase`

---

## Import Statement

```tsx
import {
  Card,
  StatCard,
  InfoCard,
  FeatureCard,
  PricingCard,
  ColoredBorderCard,
  MetricCard,
} from "@/shared/components/ui/card";
```

---

## Quick Comparison

| Component           | Best For             | Layout     | Key Feature         |
| ------------------- | -------------------- | ---------- | ------------------- |
| `StatCard`          | Dashboard metrics    | Compact    | Trend indicators    |
| `InfoCard`          | Feature descriptions | Large      | CTA link            |
| `FeatureCard`       | Benefits/features    | Flex       | Horizontal/vertical |
| `PricingCard`       | Pricing tiers        | Structured | Feature list        |
| `ColoredBorderCard` | Category display     | Grid       | Top accent          |
| `MetricCard`        | Quick stats          | Compact    | Chart placeholder   |

---

## Copy-Paste Examples

### Dashboard Metrics

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard
    title="Total Revenue"
    value="$45,231"
    subtitle="last month"
    icon={DollarSign}
    trend={{ value: "+12.5%", direction: "up" }}
  />
  <StatCard
    title="Active Users"
    value="2,342"
    subtitle="this week"
    icon={Users}
    variant="primary"
  />
  <StatCard
    title="Conversion Rate"
    value="3.24%"
    icon={TrendingUp}
    trend={{ value: "-2.1%", direction: "down" }}
    variant="success"
  />
  <StatCard title="Response Time" value="2.4h" icon={Clock} variant="warning" />
</div>
```

### Feature List (Horizontal)

```tsx
<div className="space-y-4">
  <FeatureCard
    icon={Users}
    iconColor="text-blue-600"
    iconBgColor="bg-blue-50 dark:bg-blue-950/20"
    title="Lead Management"
    description="Organize and track all your leads in one centralized platform."
    variant="horizontal"
    onClick={() => navigate("/leads")}
  />
  <FeatureCard
    icon={Zap}
    iconColor="text-purple-600"
    iconBgColor="bg-purple-50 dark:bg-purple-950/20"
    title="Automation"
    description="Automate repetitive tasks and workflows."
    variant="horizontal"
  />
</div>
```

### Feature Grid (Vertical)

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <FeatureCard
    icon={Clock}
    iconColor="text-orange-600"
    iconBgColor="bg-orange-50 dark:bg-orange-950/20"
    title="Save Time"
    description="Automate repetitive tasks and workflows."
    variant="vertical"
  />
  <FeatureCard
    icon={MessageSquare}
    iconColor="text-purple-600"
    iconBgColor="bg-purple-50 dark:bg-purple-950/20"
    title="Collaboration"
    description="Keep your team aligned with shared pipelines."
    variant="vertical"
  />
  <FeatureCard
    icon={TrendingUp}
    iconColor="text-green-600"
    iconBgColor="bg-green-50 dark:bg-green-950/20"
    title="Conversions"
    description="Track every lead through the pipeline."
    variant="vertical"
  />
</div>
```

### Pricing Table

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <PricingCard
    name="Starter"
    price="$29"
    period="/month"
    features={[
      "Up to 1,000 contacts",
      "Basic pipeline stages",
      "Email campaigns",
      "Mobile access",
    ]}
    onSelect={() => handleSelect("starter")}
  />
  <PricingCard
    name="Professional"
    price="$79"
    period="/month"
    features={[
      "Unlimited contacts",
      "Workflow automation",
      "Priority support",
      "Custom dashboards",
    ]}
    highlighted
    badgeText="Best Value"
    onSelect={() => handleSelect("pro")}
  />
  <PricingCard
    name="Enterprise"
    price="$199"
    period="/month"
    features={[
      "Custom integrations",
      "Dedicated manager",
      "SLA guarantee",
      "White-label option",
    ]}
    onSelect={() => handleSelect("enterprise")}
  />
</div>
```

### Info Card

```tsx
<InfoCard
  icon={Target}
  title="Payroll Overview"
  description="Get detailed descriptions about Payrolls Cost, Total Expense, Pending Payments, and Total Payrolls in your dashboard."
  linkText="Learn more"
  onLinkClick={() => navigate("/payroll")}
/>
```

### Colored Top Border Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <ColoredBorderCard
    icon={Clock}
    title="Save Time"
    description="Automate repetitive tasks and workflows."
    borderColor="border-t-orange-500"
    iconColor="text-orange-600"
    iconBgColor="bg-orange-50 dark:bg-orange-950/20"
  />
  <ColoredBorderCard
    icon={MessageSquare}
    title="Collaboration"
    description="Keep your team aligned."
    borderColor="border-t-purple-500"
    iconColor="text-purple-600"
    iconBgColor="bg-purple-50 dark:bg-purple-950/20"
  />
  <ColoredBorderCard
    icon={TrendingUp}
    title="Growth"
    description="Track every lead."
    borderColor="border-t-green-500"
    iconColor="text-green-600"
    iconBgColor="bg-green-50 dark:bg-green-950/20"
  />
</div>
```

---

## Color Palette Quick Pick

```tsx
// Blue (Primary, Trust)
iconColor = "text-blue-600";
iconBgColor = "bg-blue-50 dark:bg-blue-950/20";
borderColor = "border-t-blue-500";

// Purple (Automation, Innovation)
iconColor = "text-purple-600";
iconBgColor = "bg-purple-50 dark:bg-purple-950/20";
borderColor = "border-t-purple-500";

// Green (Growth, Success)
iconColor = "text-green-600";
iconBgColor = "bg-green-50 dark:bg-green-950/20";
borderColor = "border-t-green-500";

// Orange (Speed, Action)
iconColor = "text-orange-600";
iconBgColor = "bg-orange-50 dark:bg-orange-950/20";
borderColor = "border-t-orange-500";

// Pink (Engagement, Communication)
iconColor = "text-pink-600";
iconBgColor = "bg-pink-50 dark:bg-pink-950/20";
borderColor = "border-t-pink-500";

// Emerald (Money, Revenue)
iconColor = "text-emerald-600";
iconBgColor = "bg-emerald-50 dark:bg-emerald-950/20";
borderColor = "border-t-emerald-500";
```

---

## StatCard Variants

```tsx
variant = "default"; // White/transparent
variant = "primary"; // Blue tint
variant = "success"; // Green tint
variant = "warning"; // Amber tint
variant = "danger"; // Red tint
```

---

## Animation Pattern

```tsx
import { motion } from "motion/react";

<div className="grid grid-cols-3 gap-6">
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

## Responsive Grid Patterns

```tsx
// 4 columns → 2 → 1
className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6";

// 3 columns → 2 → 1
className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

// 2 columns → 1
className = "grid grid-cols-1 md:grid-cols-2 gap-6";

// Horizontal stack
className = "space-y-4";
```

---

## Common Mistakes ❌

### ❌ Don't use inline colors

```tsx
// WRONG
<FeatureCard
  iconColor="text-[#2563EB]"  // ❌ No hex codes
  iconBgColor="bg-[#EFF6FF]"  // ❌ No hex codes
/>

// CORRECT
<FeatureCard
  iconColor="text-blue-600"           // ✅ Tailwind token
  iconBgColor="bg-blue-50 dark:bg-blue-950/20"  // ✅ With dark mode
/>
```

### ❌ Don't forget dark mode

```tsx
// WRONG
iconBgColor = "bg-blue-50"; // ❌ No dark variant

// CORRECT
iconBgColor = "bg-blue-50 dark:bg-blue-950/20"; // ✅ Both modes
```

### ❌ Don't mix card types

```tsx
// WRONG - inconsistent in same grid
<StatCard ... />
<FeatureCard variant="vertical" ... />

// CORRECT - consistent card types
<StatCard ... />
<StatCard ... />
<StatCard ... />
```

---

## Integration with Existing Pages

### Replace old dashboard cards

```tsx
// OLD
<div className="bg-white rounded-lg shadow p-6">
  <h3>{title}</h3>
  <p>{value}</p>
</div>

// NEW
<StatCard title={title} value={value} icon={Icon} />
```

### Replace feature sections

```tsx
// OLD
<div className="grid grid-cols-3">
  {features.map(f => (
    <div className="p-4">
      <Icon className="text-blue-500" />
      <h3>{f.title}</h3>
      <p>{f.desc}</p>
    </div>
  ))}
</div>

// NEW
<div className="grid grid-cols-3 gap-6">
  {features.map(f => (
    <FeatureCard
      icon={f.icon}
      iconColor="text-blue-600"
      iconBgColor="bg-blue-50 dark:bg-blue-950/20"
      title={f.title}
      description={f.desc}
      variant="vertical"
    />
  ))}
</div>
```

---

## Performance Tips

```tsx
// ✅ Memoize large grids
const cardGrid = useMemo(
  () => data.map((item) => <FeatureCard key={item.id} {...item} />),
  [data],
);

// ✅ Use keys properly
{
  items.map((item) => (
    <StatCard key={item.id} {...item} /> // ✅ Stable ID
  ));
}

// ❌ Don't use index as key if data can reorder
{
  items.map((item, i) => (
    <StatCard key={i} {...item} /> // ❌ Unstable
  ));
}
```

---

## Accessibility Checklist

- ✅ All buttons have `aria-label` when needed
- ✅ Icons are decorative (use `aria-hidden` if no label)
- ✅ Focus states visible (automatic via Tailwind)
- ✅ Color contrast meets WCAG AA (4.5:1)
- ✅ Interactive cards have hover states
- ✅ Clickable cards have `cursor-pointer`

---

## File Locations

```
frontend/src/shared/components/ui/
├── card.tsx                      # All card components
├── CARD-COMPONENTS.md            # Full documentation
└── ...

frontend/src/features/tenant/pages/
└── card-showcase-page.tsx        # Live examples

frontend/app/(tenant)/
└── card-showcase/page.tsx        # Route file
```

---

## Next Steps

1. **View live demo**: Visit `/card-showcase` in development
2. **Read full docs**: See `CARD-COMPONENTS.md` for detailed API
3. **Check design system**: `.kiro/skills/leadcrm-design-system.md`
4. **Test implementation**: Use examples in your pages

---

**Questions?** Check the full documentation at `frontend/src/shared/components/ui/CARD-COMPONENTS.md`
