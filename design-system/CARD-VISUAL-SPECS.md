# Card Component Visual Specifications

> 📐 Detailed visual specifications for all card components  
> 🎨 Based on provided design samples  
> ✅ LeadCRM Design System compliant

---

## Typography Scale

```
Card Title (Large):    24px / 2xl  font-bold  font-display
Card Title (Medium):   18px / lg   font-bold
Card Title (Small):    16px / base font-bold
Metric Value:          36px / 4xl  font-bold  tracking-tight
Subtitle:              14px / sm   font-medium
Body Text:             14px / sm   regular
Small Label:           12px / xs   font-medium
```

---

## Spacing System

```
Card Padding (Standard):  24px / p-6
Card Padding (Large):     32px / p-8
Icon Container:           12px / p-3
Element Gap (Small):      8px  / gap-2
Element Gap (Medium):     16px / gap-4
Element Gap (Large):      24px / gap-6
Grid Gap:                 24px / gap-6
```

---

## Border Radius

```
Card Container:     16px / rounded-2xl
Button:             12px / rounded-xl
Icon Container:     12px / rounded-xl
Input:              8px  / rounded-lg
Badge/Pill:         9999px / rounded-full
```

---

## Shadows

```
Standard Card:      0 10px 15px -3px rgb(0 0 0 / 0.1)    shadow-lg
Elevated Card:      0 20px 25px -5px rgb(0 0 0 / 0.1)    shadow-xl
Glass Card:         0 20px 25px -5px rgb(0 0 0 / 0.1)    shadow-2xl
Hover Enhancement:  Add 2px lift + deeper shadow
```

---

## StatCard Specifications

### Layout

```
┌─────────────────────────────────────┐
│ Title               [Icon]          │  ← 14px, medium, gray-600
│                                     │
│ $12,900                             │  ← 36px, bold, gray-900
│                                     │
│ last month  ↑ +12.5%                │  ← 14px, gray-500 + green-500
└─────────────────────────────────────┘
    24px padding all sides
```

### Colors

```css
Background Light:  #ffffff
Background Dark:   rgba(255, 255, 255, 0.02)
Border Light:      #e5e7eb
Border Dark:       rgba(255, 255, 255, 0.05)
Title:             #64748b / #94a3b8
Value:             #0f172a / #f8fafc
Subtitle:          #64748b / #94a3b8
Trend Up:          #10b981
Trend Down:        #ef4444
```

### Icon Container

```
Size: 40px × 40px
Padding: 8px
Border Radius: 8px
Background Light: #f1f5f9
Background Dark: rgba(255, 255, 255, 0.05)
Icon Size: 18px
Icon Color: #64748b / #94a3b8
```

### Variants

```
default:  White/transparent background
primary:  Blue tint (#eff6ff light, rgba(30, 58, 138, 0.1) dark)
success:  Green tint (#d1fae5 light, rgba(5, 150, 105, 0.1) dark)
warning:  Amber tint (#fef3c7 light, rgba(245, 158, 11, 0.1) dark)
danger:   Red tint (#fee2e2 light, rgba(239, 68, 68, 0.1) dark)
```

---

## InfoCard Specifications

### Layout

```
┌─────────────────────────────────────────────────┐
│  ┌───┐                                          │
│  │ 📊 │  ← 48px × 48px icon container          │
│  └───┘                                          │
│                                                 │
│  Payroll Overview                               │  ← 24px, bold, display font
│                                                 │
│  Get a detailed descriptions about              │  ← 14px, gray-600
│  Payrolls Cost, Total Expense,                  │
│  Pending Payments, and Total                    │
│  Payrolls in your dashboard.                    │
│                                                 │
│  Learn more →                                   │  ← 14px, bold, blue-600, with arrow
│                                                 │
└─────────────────────────────────────────────────┘
     32px padding all sides
```

### Colors

```css
Icon Background:   #eff6ff light, rgba(30, 58, 138, 0.2) dark
Icon Color:        #2563eb light, #60a5fa dark
Title:             #0f172a light, #f8fafc dark
Description:       #64748b light, #94a3b8 dark
Link:              #2563eb light, #60a5fa dark
Link Hover:        #1d4ed8 light, #3b82f6 dark
```

### Icon Container

```
Size: 48px × 48px
Padding: 12px
Border Radius: 12px
Background: Blue/50 light, Blue/950/20 dark
Icon Size: 24px
```

---

## FeatureCard Specifications

### Horizontal Layout

```
┌────────────────────────────────────────────────┐
│  ┌───┐  Lead Management              →        │
│  │ 👥 │  Organize and track all your          │
│  └───┘  leads in one centralized              │
│         platform with smart...                │
└────────────────────────────────────────────────┘
     24px padding, 16px gap between icon & text
```

### Vertical Layout (Grid)

```
┌─────────────────────────────────┐
│  ┌───┐                          │
│  │ ⚡ │                          │  ← 56px × 56px icon
│  └───┘                          │
│                                 │
│  Save Time with Automation      │  ← 18px, bold
│                                 │
│  Automate repetitive tasks      │  ← 14px, gray-600
│  and workflows to focus on      │
│  what matters most.             │
│                                 │
└─────────────────────────────────┘
     24px padding all sides
```

### Icon Sizing

```
Horizontal Variant:
  Container: 48px × 48px
  Padding: 12px
  Icon: 24px

Vertical Variant:
  Container: 56px × 56px
  Padding: 14px
  Icon: 28px
```

### Color Combinations

```
Blue (Primary):
  Icon: text-blue-600
  Background: bg-blue-50 dark:bg-blue-950/20
  Border (if used): border-t-blue-500

Purple (Automation):
  Icon: text-purple-600
  Background: bg-purple-50 dark:bg-purple-950/20
  Border: border-t-purple-500

Green (Success/Growth):
  Icon: text-green-600
  Background: bg-green-50 dark:bg-green-950/20
  Border: border-t-green-500

Orange (Speed/Action):
  Icon: text-orange-600
  Background: bg-orange-50 dark:bg-orange-950/20
  Border: border-t-orange-500

Pink (Engagement):
  Icon: text-pink-600
  Background: bg-pink-50 dark:bg-pink-950/20
  Border: border-t-pink-500
```

---

## ColoredBorderCard Specifications

### Layout

```
┌═════════════════════════════════════┐  ← 4px colored border top
│                                     │
│  ┌───┐                              │
│  │ ⚡ │                              │
│  └───┘                              │
│                                     │
│  Save Time with Automation          │
│                                     │
│  Automate repetitive tasks and      │
│  workflows to focus on what         │
│  matters most—building              │
│  relationships and closing deals.   │
│                                     │
└─────────────────────────────────────┘
```

### Border Colors

```
border-t-4 with color:
  Orange:  #f97316
  Purple:  #a855f7
  Green:   #10b981
  Blue:    #3b82f6
  Pink:    #ec4899
```

---

## PricingCard Specifications

### Layout

```
┌─────────────────────────────────────┐
│         ┌──────────────┐            │  ← Badge (optional)
│         │ BEST VALUE   │            │
│         └──────────────┘            │
│                                     │
│         Professional                │  ← 20px, bold
│                                     │
│         $79  /month                 │  ← 36px bold + 14px
│                                     │
│  ✓  Unlimited contacts              │  ← 14px with checkmark
│  ✓  Workflow automation             │
│  ✓  Batch messaging                 │
│  ✓  Priority support                │
│  ✓  Custom dashboards               │
│  ✓  Asset tracking                  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │      Get started              │  │  ← CTA button
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
     32px padding all sides
```

### Badge (when highlighted)

```
Position: Absolute, -12px from top
Background: Linear gradient blue-600 to blue-500
Text: White, 10px, bold, uppercase, tracking-wide
Padding: 4px 16px
Border Radius: 9999px (full rounded)
```

### Checkmark Icon

```
Size: 20px × 20px
Color: #10b981 (emerald-500)
Stroke Width: 2px
Position: Inline with text, aligned to top
```

### Button Variants

```
Highlighted Plan:
  Background: #2563eb (blue-600)
  Hover: #1d4ed8 (blue-700)
  Text: White
  Shadow: 0 10px 15px -3px rgb(37 99 235 / 0.3)

Standard Plan:
  Background: #f1f5f9 light, rgba(255, 255, 255, 0.05) dark
  Hover: #e2e8f0 light, rgba(255, 255, 255, 0.08) dark
  Text: #0f172a light, #f8fafc dark
```

---

## MetricCard Specifications

### Layout

```
┌─────────────────────────────────────┐
│  Total Calls          ↑ 12%         │  ← Title + trend badge
│                                     │
│  1,234                              │  ← 30px, bold
│                                     │
│  [Optional Chart Area]              │
│                                     │
└─────────────────────────────────────┘
     24px padding all sides
```

### Trend Badge

```
Padding: 4px 8px
Border Radius: 4px
Font: 12px, semibold

Up Trend:
  Background: #d1fae5 light, rgba(52, 211, 153, 0.1) dark
  Text: #047857 light, #34d399 dark
  Arrow: ↑

Down Trend:
  Background: #fee2e2 light, rgba(248, 113, 113, 0.1) dark
  Text: #b91c1c light, #f87171 dark
  Arrow: ↓
```

---

## Animation Specifications

### Hover Effects

```css
Card Hover:
  transform: translateY(-2px)
  transition: all 200ms ease-out
  box-shadow: enhanced (deeper shadow)

Button Hover:
  background-color: darker shade
  transition: background-color 150ms ease

Active State:
  transform: scale(0.98)
  transition: transform 100ms ease
```

### Entry Animations (Grid)

```javascript
Stagger Pattern:
  Initial: { opacity: 0, y: 20 }
  Animate: { opacity: 1, y: 0 }
  Delay: index * 0.1 seconds
  Type: spring
  Stiffness: 260
  Damping: 20
```

### Focus States

```css
All Interactive Elements:
  outline: 2px solid #2563eb
  outline-offset: 2px
  transition: outline 150ms ease
```

---

## Responsive Breakpoints

```css
Mobile (< 768px):
  - Single column layout
  - Full width cards
  - Reduced padding (16px)
  - Smaller text sizes

Tablet (768px - 1024px):
  - 2 column grid for StatCards
  - 2 column grid for FeatureCards
  - 1-2 columns for PricingCards
  - Standard padding (24px)

Desktop (> 1024px):
  - 4 column grid for StatCards
  - 3 column grid for FeatureCards
  - 3 column grid for PricingCards
  - Full padding (24px-32px)
```

---

## Accessibility Specifications

### Color Contrast Ratios

```
Light Mode:
  Title on White: 16.0:1 ✅ (AAA)
  Body on White: 8.0:1 ✅ (AAA)
  Secondary on White: 4.5:1 ✅ (AA)

Dark Mode:
  Title on Dark: 15.5:1 ✅ (AAA)
  Body on Dark: 7.5:1 ✅ (AAA)
  Secondary on Dark: 4.6:1 ✅ (AA)
```

### Touch Targets

```
Minimum Size: 44px × 44px
Spacing Between: 8px minimum
Button Height: 44px
Icon Button: 44px × 44px
```

### Focus Indicators

```
All Interactive Elements:
  outline: 2px solid #2563eb
  outline-offset: 2px
  visible on keyboard focus
  never display: none
```

---

## Dark Mode Specifications

### Background Layers

```
Page Background:     #030712
Card Background:     rgba(255, 255, 255, 0.02)
Elevated Surface:    #121826
Glass Background:    rgba(255, 255, 255, 0.02) + blur
```

### Border Colors

```
Standard Border:     rgba(255, 255, 255, 0.05)
Subtle Border:       rgba(255, 255, 255, 0.03)
Accent Border:       rgba(255, 255, 255, 0.08)
```

### Text Colors

```
Primary Text:        #f8fafc
Secondary Text:      #94a3b8
Tertiary Text:       #64748b
Disabled Text:       #475569
```

### Opacity Guidelines

```
White overlays:      2% - 8% (0.02 - 0.08)
Border opacity:      5% - 8% (0.05 - 0.08)
Text secondary:      60% - 80% (slate scale)
Hover enhancement:   +3% opacity
```

---

## Implementation Checklist

When creating or modifying cards, verify:

- [ ] Font family uses `font-display` for card titles
- [ ] All text colors include dark mode variants
- [ ] Border radius is consistent (rounded-2xl for cards)
- [ ] Padding follows 24px/32px standard
- [ ] Icon containers are properly sized
- [ ] Hover states use translateY(-2px)
- [ ] Color contrast meets WCAG AA minimum
- [ ] Touch targets are 44×44px minimum
- [ ] Focus states are visible
- [ ] Reduced motion is respected
- [ ] All colors use Tailwind tokens (no hex)
- [ ] Shadow depth is appropriate for hierarchy
- [ ] Spacing uses gap utilities consistently
- [ ] Typography scale is followed exactly

---

## Design Token Reference

```css
/* Card Structure */
--card-radius: 16px;
--card-padding: 24px;
--card-padding-lg: 32px;
--card-gap: 16px;

/* Shadows */
--shadow-card: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-card-hover: 0 20px 25px -5px rgb(0 0 0 / 0.1);

/* Transitions */
--transition-hover: all 200ms ease-out;
--transition-focus: outline 150ms ease;
--transition-color: background-color 150ms ease;

/* Animation */
--spring-stiffness: 260;
--spring-damping: 20;
--stagger-delay: 0.1s;
```

---

**Reference Date:** August 10, 2026  
**Design System Version:** LeadCRM 1.0  
**Based on:** Provided design samples  
**Framework:** Tailwind CSS v4 + Next.js 15
