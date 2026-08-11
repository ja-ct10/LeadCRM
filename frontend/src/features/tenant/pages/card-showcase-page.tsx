'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  Target,
  Zap,
  Globe,
  MessageSquare,
  BarChart3,
  Shield,
  Megaphone,
  Database,
  PhoneCall,
  Mail,
  Calendar,
  FileText
} from 'lucide-react';

import {
  Card,
  StatCard,
  InfoCard,
  FeatureCard,
  PricingCard,
  ColoredBorderCard,
  MetricCard
} from '../../../shared/components/ui/card';

export default function CardShowcasePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
            Card Component Showcase
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Complete card component library following LeadCRM design system
          </p>
        </div>

        {/* Stat Cards Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Stat Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Revenue"
              value="$45,231"
              subtitle="last month"
              icon={DollarSign}
              trend={{ value: '+12.5%', direction: 'up' }}
            />
            <StatCard
              title="Active Users"
              value="2,342"
              subtitle="this week"
              icon={Users}
              trend={{ value: '+5.2%', direction: 'up' }}
              variant="primary"
            />
            <StatCard
              title="Conversion Rate"
              value="3.24%"
              subtitle="last 30 days"
              icon={TrendingUp}
              trend={{ value: '-2.1%', direction: 'down' }}
              variant="success"
            />
            <StatCard
              title="Avg Response Time"
              value="2.4h"
              subtitle="current"
              icon={Clock}
              variant="warning"
            />
          </div>
        </section>

        {/* Info Card Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Info Cards
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InfoCard
              icon={Target}
              title="Payroll Overview"
              description="Get a detailed descriptions about Payrolls Cost, Total Expense, Pending Payments, and Total Payrolls in your dashboard."
              linkText="Learn more"
              onLinkClick={() => console.log('Clicked!')}
            />
            <InfoCard
              icon={BarChart3}
              title="Analytics Dashboard"
              description="Track your business metrics in real-time with comprehensive analytics and customizable reports tailored to your needs."
              linkText="View dashboard"
              onLinkClick={() => console.log('Clicked!')}
            />
          </div>
        </section>

        {/* Horizontal Feature Cards */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Horizontal Feature Cards
          </h2>
          <div className="space-y-4">
            <FeatureCard
              icon={Users}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-50 dark:bg-blue-950/20"
              title="Lead Management"
              description="Organize and track all your leads in one centralized platform with smart segmentation."
              variant="horizontal"
              onClick={() => console.log('Clicked!')}
            />
            <FeatureCard
              icon={Zap}
              iconColor="text-purple-600"
              iconBgColor="bg-purple-50 dark:bg-purple-950/20"
              title="Workflow Automation"
              description="Automate repetitive tasks and workflows to focus on what matters most—building relationships."
              variant="horizontal"
              onClick={() => console.log('Clicked!')}
            />
            <FeatureCard
              icon={Globe}
              iconColor="text-emerald-600"
              iconBgColor="bg-emerald-50 dark:bg-emerald-950/20"
              title="Global Access"
              description="Access your CRM from anywhere with cloud-based infrastructure and mobile support."
              variant="horizontal"
              onClick={() => console.log('Clicked!')}
            />
          </div>
        </section>

        {/* Vertical Feature Cards Grid */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Vertical Feature Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Clock}
              iconColor="text-orange-600"
              iconBgColor="bg-orange-50 dark:bg-orange-950/20"
              title="Save Time with Automation"
              description="Automate repetitive tasks and workflows to focus on what matters most—building relationships and closing deals."
              variant="vertical"
            />
            <FeatureCard
              icon={MessageSquare}
              iconColor="text-purple-600"
              iconBgColor="bg-purple-50 dark:bg-purple-950/20"
              title="Improve Team Collaboration"
              description="Keep your team aligned with shared pipelines, task assignments, and real-time updates."
              variant="vertical"
            />
            <FeatureCard
              icon={TrendingUp}
              iconColor="text-green-600"
              iconBgColor="bg-green-50 dark:bg-green-950/20"
              title="Increase Conversion Rates"
              description="Track every lead through the pipeline with insights that help you convert more prospects into customers."
              variant="vertical"
            />
            <FeatureCard
              icon={Globe}
              iconColor="text-orange-600"
              iconBgColor="bg-orange-50 dark:bg-orange-950/20"
              title="Access it Anywhere at Any Time"
              description="Work from anywhere with cloud-based access on desktop and mobile devices."
              variant="vertical"
            />
            <FeatureCard
              icon={Megaphone}
              iconColor="text-pink-600"
              iconBgColor="bg-pink-50 dark:bg-pink-950/20"
              title="Maximize Your Reach"
              description="Reach more contacts with batch email and SMS campaigns, all from one platform."
              variant="vertical"
            />
            <FeatureCard
              icon={Database}
              iconColor="text-pink-600"
              iconBgColor="bg-pink-50 dark:bg-pink-950/20"
              title="Manage the Full Customer Journey"
              description="From first contact to closed deal, maintain a complete view of every customer interaction and history."
              variant="vertical"
            />
          </div>
        </section>

        {/* Colored Top Border Cards */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Colored Top Border Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ColoredBorderCard
              icon={Clock}
              title="Save Time with Automation"
              description="Automate repetitive tasks and workflows to focus on what matters most—building relationships and closing deals."
              borderColor="border-t-orange-500"
              iconColor="text-orange-600"
              iconBgColor="bg-orange-50 dark:bg-orange-950/20"
            />
            <ColoredBorderCard
              icon={MessageSquare}
              title="Improve Team Collaboration"
              description="Keep your team aligned with shared pipelines, task assignments, and real-time updates."
              borderColor="border-t-purple-500"
              iconColor="text-purple-600"
              iconBgColor="bg-purple-50 dark:bg-purple-950/20"
            />
            <ColoredBorderCard
              icon={TrendingUp}
              title="Increase Conversion Rates"
              description="Track every lead through the pipeline with insights that help you convert more prospects into customers."
              borderColor="border-t-green-500"
              iconColor="text-green-600"
              iconBgColor="bg-green-50 dark:bg-green-950/20"
            />
            <ColoredBorderCard
              icon={Globe}
              title="Access it Anywhere"
              description="Work from anywhere with cloud-based access on desktop and mobile devices."
              borderColor="border-t-orange-500"
              iconColor="text-orange-600"
              iconBgColor="bg-orange-50 dark:bg-orange-950/20"
            />
            <ColoredBorderCard
              icon={Megaphone}
              title="Maximize Your Reach"
              description="Reach more contacts with batch email and SMS campaigns, all from one platform."
              borderColor="border-t-purple-500"
              iconColor="text-purple-600"
              iconBgColor="bg-purple-50 dark:bg-purple-950/20"
            />
            <ColoredBorderCard
              icon={Database}
              title="Full Customer Journey"
              description="From first contact to closed deal, maintain a complete view of every customer interaction."
              borderColor="border-t-pink-500"
              iconColor="text-pink-600"
              iconBgColor="bg-pink-50 dark:bg-pink-950/20"
            />
          </div>
        </section>

        {/* Metric Cards */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Metric Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Calls"
              value="1,234"
              change={{ value: '12%', direction: 'up' }}
            />
            <MetricCard
              title="Email Sent"
              value="5,678"
              change={{ value: '8%', direction: 'up' }}
            />
            <MetricCard
              title="Meetings Scheduled"
              value="89"
              change={{ value: '3%', direction: 'down' }}
            />
            <MetricCard
              title="Documents Shared"
              value="234"
              change={{ value: '15%', direction: 'up' }}
            />
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Pricing Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PricingCard
              name="Starter"
              price="$29"
              period="/month"
              features={[
                'Up to 1,000 contacts',
                'Basic pipeline stages',
                'Email & SMS campaigns',
                'Mobile app access',
                'Standard reports'
              ]}
              onSelect={() => console.log('Selected Starter')}
            />
            <PricingCard
              name="Professional"
              price="$79"
              period="/month"
              features={[
                'Unlimited contacts',
                'Workflow automation',
                'Batch messaging',
                'Priority support',
                'Custom dashboards',
                'Asset tracking'
              ]}
              highlighted
              badgeText="Best Value"
              onSelect={() => console.log('Selected Professional')}
            />
            <PricingCard
              name="Enterprise"
              price="$199"
              period="/month"
              features={[
                'Custom integrations',
                'Dedicated account manager',
                'SLA guarantee',
                'Advanced audit trails',
                'White-label option',
                'Multi-branch access'
              ]}
              onSelect={() => console.log('Selected Enterprise')}
            />
          </div>
        </section>

        {/* Mixed Layout Example */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Mixed Layout Example
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <InfoCard
                icon={Shield}
                title="Enterprise Security"
                description="Bank-level encryption, role-based access control, audit logs, and compliance with industry standards. Your data is protected at every layer with SOC 2 Type II certification and regular security audits."
                linkText="View security details"
                onLinkClick={() => console.log('Clicked!')}
              />
            </div>
            <div className="space-y-6">
              <StatCard
                title="Uptime"
                value="99.9%"
                subtitle="last 30 days"
                icon={Shield}
                variant="success"
              />
              <StatCard
                title="Support Response"
                value="< 1h"
                subtitle="average"
                icon={MessageSquare}
                variant="primary"
              />
            </div>
          </div>
        </section>

        {/* Card Grid with Animation */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-display">
            Animated Grid Entry
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: PhoneCall, title: 'Phone Support', desc: '24/7 dedicated support team', color: 'blue' },
              { icon: Mail, title: 'Email Campaigns', desc: 'Batch email with templates', color: 'purple' },
              { icon: Calendar, title: 'Meeting Scheduler', desc: 'Integrated calendar sync', color: 'green' },
              { icon: FileText, title: 'Document Manager', desc: 'Centralized file storage', color: 'orange' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: index * 0.1,
                  type: 'spring',
                  stiffness: 260,
                  damping: 20
                }}
              >
                <FeatureCard
                  icon={item.icon}
                  iconColor={`text-${item.color}-600`}
                  iconBgColor={`bg-${item.color}-50 dark:bg-${item.color}-950/20`}
                  title={item.title}
                  description={item.desc}
                  variant="vertical"
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Usage Note */}
        <Card className="p-8 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
            💡 Component Usage
          </h3>
          <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
            All card components follow LeadCRM's design system with full dark mode support, 
            consistent spacing, hover states, and accessibility features. Import from{' '}
            <code className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 font-mono text-xs">
              shared/components/ui/card
            </code>
          </p>
        </Card>
      </div>
    </div>
  );
}
