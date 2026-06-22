import React from 'react';
import { motion } from 'motion/react';

// Single Stat Card Skeleton Component
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-250 dark:border-white/[0.05] shadow-lg flex flex-col justify-between h-full relative overflow-hidden group">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/10 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite] dark:via-white/[0.02]" />
      
      <div className="flex justify-between items-start mb-4 animate-pulse">
        {/* Shimmering Icon Box */}
        <div className="w-11 h-11 bg-slate-200 dark:bg-white/10 rounded-xl" />
        {/* Shimmering Trend Pill */}
        <div className="w-14 h-5 bg-slate-200 dark:bg-white/10 rounded-full" />
      </div>

      <div className="space-y-2 animate-pulse pb-1">
        {/* Shimmering Header Label */}
        <div className="h-3.5 bg-slate-200 dark:bg-white/5 rounded-full w-24" />
        {/* Shimmering Big Value */}
        <div className="h-7 bg-slate-300 dark:bg-white/10 rounded-full w-36" />
      </div>
    </div>
  );
}

// Bar Chart Widget Skeleton
export function Chart1Skeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-250 dark:border-white/[0.05] shadow-lg flex flex-col h-full relative overflow-hidden">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/10 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite] dark:via-white/[0.02]" />
      
      <div className="mb-6 flex justify-between items-center shrink-0 animate-pulse">
        <div className="space-y-2">
          {/* Shimmering Title */}
          <div className="h-5 bg-slate-300 dark:bg-white/10 rounded-full w-40" />
          {/* Shimmering Subheading */}
          <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-56" />
        </div>
        {/* Shimmering View Report Button */}
        <div className="w-24 h-8 bg-slate-205 dark:bg-white/10 rounded-lg" />
      </div>

      {/* Shimmering Chart Content */}
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-4 animate-pulse pb-2 pt-4">
        {/* Graphic Bars */}
        <div className="flex items-end justify-between px-4 h-48 border-b border-dashed border-slate-200 dark:border-white/10">
          {[60, 85, 45, 95, 70, 80].map((height, i) => (
            <div key={i} className="flex gap-2 items-end w-12 justify-center">
              <div 
                className="bg-slate-300 dark:bg-white/10 rounded-t-lg transition-all duration-300"
                style={{ height: `${height}%`, width: '12px' }}
              />
              <div 
                className="bg-slate-200 dark:bg-white/5 rounded-t-lg transition-all duration-300"
                style={{ height: `${height * 0.7}%`, width: '12px' }}
              />
            </div>
          ))}
        </div>
        
        {/* Legend / Footer Skeletons */}
        <div className="flex justify-center gap-6 mt-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/10" />
            <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-16" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-white/5" />
            <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Sales Leaderboard Widget Skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-250 dark:border-white/[0.05] shadow-lg flex flex-col h-full relative overflow-hidden">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/10 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite] dark:via-white/[0.02]" />

      <div className="mb-6 shrink-0 animate-pulse space-y-2">
        {/* Shimmering Title */}
        <div className="h-5 bg-slate-300 dark:bg-white/10 rounded-full w-44" />
        {/* Shimmering Subtitle */}
        <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-32" />
      </div>

      {/* Repeating User Rows */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 animate-pulse">
        {[1, 2, 3, 4, 5].map((item) => (
          <div 
            key={item} 
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-100 dark:border-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              {/* Shimmering User Circle */}
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="space-y-1.5">
                {/* Name */}
                <div className="h-3.5 bg-slate-300 dark:bg-white/10 rounded-full w-28" />
                {/* Stat details */}
                <div className="h-2.5 bg-slate-200 dark:bg-white/5 rounded-full w-14" />
              </div>
            </div>
            
            <div className="text-right space-y-1.5">
              {/* Value indicator */}
              <div className="h-3.5 bg-slate-300 dark:bg-white/10 rounded-full w-16 ml-auto" />
              {/* Secondary details */}
              <div className="h-2.5 bg-slate-200 dark:bg-white/5 rounded-full w-10 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut / Pipeline Widget Skeleton
export function Chart2Skeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-250 dark:border-white/[0.05] shadow-lg flex flex-col h-full relative overflow-hidden">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/10 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite] dark:via-white/[0.02]" />

      <div className="mb-6 shrink-0 animate-pulse space-y-2">
        {/* Shimmering Title */}
        <div className="h-5 bg-slate-300 dark:bg-white/10 rounded-full w-40" />
        {/* Shimmering Description */}
        <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-24" />
      </div>

      {/* Shimmer Donut Visual Area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center animate-pulse">
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Circular Track Ring */}
          <div className="absolute inset-0 rounded-full border-[18px] border-slate-100 dark:border-white/[0.04]" />
          {/* Accent Colored Arc Mask */}
          <div className="absolute inset-2 rounded-full border-[10px] border-dashed border-slate-250 dark:border-white/10 animate-spin [animation-duration:15s]" />
          {/* Central Donut Hole label */}
          <div className="flex flex-col items-center space-y-1 text-center">
            <div className="w-10 h-3 bg-slate-200 dark:bg-white/5 rounded-full" />
            <div className="w-14 h-4.5 bg-slate-300 dark:bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Area Chart / Trend Widget Skeleton
export function Chart3Skeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.02] p-6 rounded-2xl border border-gray-250 dark:border-white/[0.05] shadow-lg flex flex-col h-full relative overflow-hidden">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/10 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite] dark:via-white/[0.02]" />

      <div className="mb-6 flex justify-between items-center shrink-0 animate-pulse">
        <div className="space-y-2">
          {/* Shimmering Title */}
          <div className="h-5 bg-slate-300 dark:bg-white/10 rounded-full w-36" />
          {/* Shimmering Description */}
          <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-48" />
        </div>
        {/* Trend Indicator Pill */}
        <div className="w-24 h-6.5 bg-slate-200 dark:bg-white/15 rounded-full" />
      </div>

      {/* Curve Shimmering Path */}
      <div className="flex-1 min-h-0 flex flex-col justify-end animate-pulse">
        <div className="relative h-44 border-b border-slate-200 dark:border-white/10 overflow-hidden">
          {/* Mimicking a curvy Wave Shape */}
          <svg className="absolute bottom-0 w-full h-full text-slate-200/50 dark:text-white/[0.04]" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,80 Q25,30 50,70 T100,20 L100,100 L0,100 Z" />
          </svg>
          {/* Linear Grid Lines */}
          <div className="absolute left-0 right-0 top-1/4 h-px border-t border-dashed border-slate-250/30 dark:border-white/5" />
          <div className="absolute left-0 right-0 top-2/4 h-px border-t border-dashed border-slate-250/30 dark:border-white/5" />
          <div className="absolute left-0 right-0 top-3/4 h-px border-t border-dashed border-slate-250/30 dark:border-white/5" />
        </div>

        {/* X-Axis labels */}
        <div className="flex justify-between px-2 pt-3">
          {['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((label) => (
            <div key={label} className="h-3 bg-slate-200 dark:bg-white/5 rounded-full w-10 text-center" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Full Dashboard Skeleton Grid matching perfect structural dimensions
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 6 Stats Skeletons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Middle Row Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        <div className="lg:col-span-8 h-[360px]">
          <Chart3Skeleton />
        </div>
        <div className="lg:col-span-4 h-[360px]">
          <LeaderboardSkeleton />
        </div>
      </div>

      {/* Bottom Row Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-6 pt-2">
        <div className="md:col-span-1 lg:col-span-4 h-[360px]">
          <Chart1Skeleton />
        </div>
        <div className="md:col-span-1 lg:col-span-4 h-[360px]">
          <LeaderboardSkeleton />
        </div>
        <div className="md:col-span-1 lg:col-span-4 h-[360px]">
          <Chart2Skeleton />
        </div>
      </div>
    </div>
  );
}
