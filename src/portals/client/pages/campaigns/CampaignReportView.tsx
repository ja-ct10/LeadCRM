import React from 'react';
import {
  ArrowLeft, Send, Eye, MousePointerClick, MessageSquare, X, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from '../../../../shared/components/charts/ChartComponents';
import { Campaign } from '../../../../store/types';

// ─── Static chart data ────────────────────────────────────────────────────────

const REPORT_DATA = [
  { name: 'Day 1', opens: 400, clicks: 240 },
  { name: 'Day 2', opens: 300, clicks: 139 },
  { name: 'Day 3', opens: 200, clicks: 980 },
  { name: 'Day 4', opens: 278, clicks: 390 },
  { name: 'Day 5', opens: 189, clicks: 480 },
  { name: 'Day 6', opens: 239, clicks: 380 },
  { name: 'Day 7', opens: 349, clicks: 430 },
];

const DEVICE_DATA = [
  { name: 'Mobile', value: 55 },
  { name: 'Desktop', value: 40 },
  { name: 'Tablet', value: 5 },
];

const DEVICE_COLORS = ['#10B981', '#0A6EFF', '#F59E0B'];

const TOP_LINKS = [
  { url: 'https://leadcrm.com/pricing', clicks: 842 },
  { url: 'https://leadcrm.com/features/automation', clicks: 531 },
  { url: 'https://leadcrm.com/book-demo', clicks: 289 },
];

const BOUNCE_RATE = 2.4;

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricTab = 'sent' | 'delivered' | 'opened' | 'clicked' | 'responded' | 'bounced';

interface CampaignReportViewProps {
  campaign: Campaign;
  activeMetricTab: MetricTab;
  onMetricTabChange: (tab: MetricTab) => void;
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveMetrics(campaign: Campaign) {
  const sent = campaign.sentCount ?? 0;
  const bounce = sent ? Math.round(sent * (BOUNCE_RATE / 100)) : 0;
  const delivered = sent ? Math.round(sent * 0.976) : 0;
  const deliveredPct = sent ? 97.6 : 0;
  const opened = campaign.openedCount ?? 0;
  const openedPct = sent ? Math.round((opened / sent) * 100) : 0;
  const clicked = campaign.clickedCount ?? 0;
  const clickedPct = sent ? Math.round((clicked / sent) * 100) : 0;
  const responded = opened ? Math.round(opened * 0.15) : 0;
  const respondedPct = sent ? Math.round((responded / sent) * 1000) / 10 : 0;
  return { sent, bounce, delivered, deliveredPct, opened, openedPct, clicked, clickedPct, responded, respondedPct };
}

function getMetricTabActiveClass(tab: MetricTab, active: MetricTab): string {
  const colorMap: Record<MetricTab, string> = {
    sent:      'bg-blue-50/50 dark:bg-blue-950/20 border-[#0A6EFF] shadow-[0_0_15px_rgba(10,110,255,0.1)]',
    delivered: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    opened:    'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    clicked:   'bg-blue-50/50 dark:bg-blue-950/20 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.1)]',
    responded: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
    bounced:   'bg-red-50/50 dark:bg-red-950/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
  };
  const inactive = 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.12]';
  return tab === active ? colorMap[tab] : inactive;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CampaignReportView({
  campaign,
  activeMetricTab,
  onMetricTabChange,
  onBack,
}: CampaignReportViewProps) {
  const m = deriveMetrics(campaign);

  const metricPanelText: Record<MetricTab, string> = {
    sent:      `The campaign broadcast successfully hit ${m.sent.toLocaleString()} active target contacts in the segment.`,
    delivered: `High sender reputation yielded a success rate of ${m.deliveredPct}% with ${m.delivered.toLocaleString()} delivered emails.`,
    opened:    `${m.opened.toLocaleString()} individual contacts opened. Peak engagement occurred between 9:00 AM – 11:30 AM.`,
    clicked:   `${m.clicked.toLocaleString()} custom links were engaged (${m.clickedPct}% rate). The pricing sheet link led with 72% of total clicks.`,
    responded: `${m.responded.toLocaleString()} contacts took action by writing a manual response or auto-initiating a direct CRM scheduling trigger.`,
    bounced:   `Soft bounce retry logs: 1.8% soft, 0.6% hard bounces. System automatically quarantined 3 inaccurate contact addresses.`,
  };

  const metricPanelTitle: Record<MetricTab, string> = {
    sent:      'Sent Overview',
    delivered: 'In-box Delivery Report',
    opened:    'Recipient Open Behavior',
    clicked:   'Click Link Performance',
    responded: 'Contact Response Breakdown',
    bounced:   'Bounces & Deliverability',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {campaign.name} Report
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Detailed performance metrics and insights</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Sent */}
          <button type="button" onClick={() => onMetricTabChange('sent')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('sent', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Sent</h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{m.sent.toLocaleString()}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> 100% Sent
            </div>
          </button>

          {/* Delivered */}
          <button type="button" onClick={() => onMetricTabChange('delivered')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('delivered', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              Delivered
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">New</span>
            </h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{m.delivered.toLocaleString()}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {m.deliveredPct}% Rate
            </div>
          </button>

          {/* Open rate */}
          <button type="button" onClick={() => onMetricTabChange('opened')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('opened', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Open Rate</h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{m.openedPct}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> {m.opened.toLocaleString()} opened
            </div>
          </button>

          {/* Click rate */}
          <button type="button" onClick={() => onMetricTabChange('clicked')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('clicked', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Click Rate</h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{m.clickedPct}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" /> {m.clicked.toLocaleString()} clicked
            </div>
          </button>

          {/* Responded */}
          <button type="button" onClick={() => onMetricTabChange('responded')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('responded', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              Responded
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">New</span>
            </h3>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{m.responded.toLocaleString()}</div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> {m.respondedPct}% Rate
            </div>
          </button>

          {/* Bounced */}
          <button type="button" onClick={() => onMetricTabChange('bounced')}
            className={`text-left rounded-xl p-5 border transition-all ${getMetricTabActiveClass('bounced', activeMetricTab)}`}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Bounce Rate</h3>
            <div className="text-2xl font-black text-red-500 dark:text-red-400">{BOUNCE_RATE}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> {m.bounce.toLocaleString()} bounced
            </div>
          </button>
        </div>

        {/* Active metric panel */}
        <div className="p-4 bg-slate-50 dark:bg-[#0c0f16] border border-gray-200 dark:border-white/[0.04] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${
              activeMetricTab === 'sent'      ? 'bg-blue-500/10 text-blue-500' :
              activeMetricTab === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
              activeMetricTab === 'opened'    ? 'bg-sky-500/10 text-sky-500' :
              activeMetricTab === 'clicked'   ? 'bg-teal-500/10 text-teal-500' :
              activeMetricTab === 'responded' ? 'bg-indigo-500/10 text-indigo-500' :
                                                'bg-red-500/10 text-red-500'
            }`}>
              {activeMetricTab === 'sent'      && <Send size={18} />}
              {activeMetricTab === 'delivered' && <Sparkles size={18} />}
              {activeMetricTab === 'opened'    && <Eye size={18} />}
              {activeMetricTab === 'clicked'   && <MousePointerClick size={18} />}
              {activeMetricTab === 'responded' && <MessageSquare size={18} />}
              {activeMetricTab === 'bounced'   && <X size={18} />}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                {metricPanelTitle[activeMetricTab]}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {metricPanelText[activeMetricTab]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 bg-white dark:bg-black/20 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.05]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono">Status:</span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Live
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement over time */}
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.05]">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Engagement Over Time</h3>
          <div className="h-64 relative w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={REPORT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A6EFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0A6EFF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="opens" stroke="#0A6EFF" fillOpacity={1} fill="url(#colorOpens)" name="Opens" />
                <Area type="monotone" dataKey="clicks" stroke="#10B981" fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device breakdown */}
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.05]">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Device Breakdown</h3>
          <div className="h-64 relative w-full min-w-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={DEVICE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {DEVICE_DATA.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col gap-2 ml-48">
              {DEVICE_DATA.map((device, index) => (
                <div key={device.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEVICE_COLORS[index] }} />
                  <span className="text-slate-700 dark:text-slate-300">{device.name}</span>
                  <span className="text-slate-900 dark:text-white font-medium ml-2">{device.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top links */}
        <div className="bg-white dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.05]">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Top Links Clicked</h3>
          <div className="space-y-4 mt-6">
            {TOP_LINKS.map((link, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-6 h-6 rounded bg-gray-50 dark:bg-white/[0.05] flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-gray-200 dark:border-white/[0.05] shrink-0">
                    {index + 1}
                  </div>
                  <a href="#" className="text-sm text-blue-400 hover:text-blue-300 truncate transition-colors">
                    {link.url}
                  </a>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white bg-gray-50 dark:bg-white/[0.05] px-2.5 py-1 rounded-md border border-gray-200 dark:border-white/[0.05] shrink-0 ml-4">
                  {link.clicks} clicks
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
