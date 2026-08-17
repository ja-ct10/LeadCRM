import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordPanel } from './RecordPanel';
import {
  DEFAULT_LEAD_STATUSES,
  DEFAULT_CONTACT_STATUSES,
  DEFAULT_ACCOUNT_STATUSES,
  DEFAULT_PIPELINE,
} from './moduleConfig';
import { Info } from 'lucide-react';

describe('moduleConfig defaults', () => {
  it('defines valid lead statuses with tones', () => {
    expect(DEFAULT_LEAD_STATUSES.length).toBeGreaterThan(0);
    expect(DEFAULT_LEAD_STATUSES.some((s) => s.label === 'Inquiry')).toBe(true);
    expect(DEFAULT_LEAD_STATUSES.some((s) => s.label === 'Hot')).toBe(true);
  });

  it('defines valid contact statuses', () => {
    expect(DEFAULT_CONTACT_STATUSES.some((s) => s.label === 'Qualified')).toBe(true);
    expect(DEFAULT_CONTACT_STATUSES.some((s) => s.label === 'Converted')).toBe(true);
  });

  it('defines valid account classifications', () => {
    expect(DEFAULT_ACCOUNT_STATUSES.some((s) => s.label === 'Prospect')).toBe(true);
    expect(DEFAULT_ACCOUNT_STATUSES.some((s) => s.label === 'Active Customer')).toBe(true);
  });

  it('defines default sales pipeline with stages', () => {
    expect(DEFAULT_PIPELINE.name).toBe('Sales Pipeline');
    expect(DEFAULT_PIPELINE.stages.some((st) => st.label === 'Won')).toBe(true);
  });
});

describe('RecordPanel Component', () => {
  const dummyRecord = {
    id: 'rec-1',
    title: 'Acme Corporation',
    subtitle: 'acme.com · Primary Enterprise',
    metadataCount: 3,
  };

  const dummyActivity = [
    {
      id: 'act-1',
      kind: 'created' as const,
      title: 'Lead created for Acme Corporation',
      when: 'Aug 18',
      actor: { name: 'Reymark Panes', initials: 'RP' },
    },
    {
      id: 'act-2',
      kind: 'status' as const,
      from: 'Inquiry',
      to: 'Hot',
      when: 'Just now',
    },
  ];

  const dummySections = [
    {
      id: 'about',
      title: 'About Acme',
      icon: Info,
      content: <div data-testid="about-content">Company details here</div>,
    },
  ];

  it('renders record header with title, subtitle, and status button when open', () => {
    const handleOpenChange = vi.fn();
    const handleStatusChange = vi.fn();

    render(
      <RecordPanel
        open={true}
        onOpenChange={handleOpenChange}
        module="lead"
        record={dummyRecord}
        statuses={DEFAULT_LEAD_STATUSES}
        status="Hot"
        onStatusChange={handleStatusChange}
        activity={dummyActivity}
        sections={dummySections}
      />
    );

    expect(screen.getByText('Acme Corporation')).toBeDefined();
    expect(screen.getByText('acme.com · Primary Enterprise')).toBeDefined();
    expect(screen.getAllByText('Hot').length).toBeGreaterThanOrEqual(1);
  });

  it('renders activity items with actor initials and status transition chips', () => {
    render(
      <RecordPanel
        open={true}
        onOpenChange={() => {}}
        module="lead"
        record={dummyRecord}
        statuses={DEFAULT_LEAD_STATUSES}
        status="Hot"
        onStatusChange={() => {}}
        activity={dummyActivity}
        sections={dummySections}
      />
    );

    expect(screen.getByText('Lead created for Acme Corporation')).toBeDefined();
    expect(screen.getByText('Status changed from')).toBeDefined();
    expect(screen.getByText('Inquiry')).toBeDefined();
    expect(screen.getByText('RP')).toBeDefined();
  });

  it('triggers action callbacks when action buttons are clicked', () => {
    const emailMock = vi.fn();
    const callMock = vi.fn();

    render(
      <RecordPanel
        open={true}
        onOpenChange={() => {}}
        module="lead"
        record={dummyRecord}
        statuses={DEFAULT_LEAD_STATUSES}
        status="Hot"
        onStatusChange={() => {}}
        activity={dummyActivity}
        sections={dummySections}
        actions={{
          email: emailMock,
          call: callMock,
        }}
      />
    );

    const emailButton = screen.getByLabelText('Email');
    fireEvent.click(emailButton);
    expect(emailMock).toHaveBeenCalledTimes(1);

    const callButton = screen.getByLabelText('Call');
    fireEvent.click(callButton);
    expect(callMock).toHaveBeenCalledTimes(1);
  });
});
