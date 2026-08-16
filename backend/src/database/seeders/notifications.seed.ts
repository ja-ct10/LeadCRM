import prisma from '../../config/database.config';

/**
 * Seed sample notifications for testing and development.
 * Creates realistic notification examples for all major event types.
 */
export async function seedNotifications(): Promise<void> {
  console.log('🔔 Seeding notifications...');

  const tenants = await prisma.tenant.findMany({
    where: { name: { in: ['Reymark Demo Co.', 'Demo Company'] } },
  });

  if (tenants.length === 0) {
    console.log('⚠️  No demo tenants found. Skipping notifications seed.');
    return;
  }

  for (const tenant of tenants) {
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      take: 3,
    });

    if (users.length === 0) continue;

    const [user1, user2] = users;

    const notifications = [
      // Today's notifications (user1)
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'campaign_sent',
        title: 'Email Campaign Sent',
        body: 'Your Spring Sale Promo email just went out to 10,000 users. 🎉',
        entityType: 'campaign',
        entityId: null,
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      },
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'open_rate_update',
        title: 'Open Rate Update',
        body: 'Your last email campaign reached a 45% open rate. Trending upward! 📈',
        entityType: 'campaign',
        entityId: null,
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      },
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'engagement_alert',
        title: 'High Engagement Alert',
        body: 'iPhone 15 Flash Sale push notification had a 28% CTR! That\'s 🔥.',
        entityType: 'campaign',
        entityId: null,
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      },

      // Yesterday's notifications (user1)
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'budget_alert',
        title: 'Ad Budget Update',
        body: 'Your sponsored ad for Gaming Laptops has used 75% of its budget. Time to review.',
        entityType: 'campaign',
        entityId: null,
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'scheduled_reminder',
        title: 'Scheduled Email Reminder',
        body: 'Laptop Clearance Sale email is scheduled for tomorrow at 11:11 AM.',
        entityType: 'campaign',
        entityId: null,
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26), // 1 day + 2 hours ago
      },
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'new_leads',
        title: 'New Leads Captured',
        body: 'You gained 350 new email subscribers from the ad campaign! 🙌',
        entityType: 'contact',
        entityId: null,
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28), // 1 day + 4 hours ago
      },

      // Older notifications (user1)
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'listing_expiring',
        title: 'Sponsored Listing Expiring',
        body: 'Your Featured Laptop Ad expires in 24 hours.',
        entityType: 'campaign',
        entityId: null,
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      },
      {
        tenantId: tenant.id,
        userId: user1.id,
        type: 'approval_pending',
        title: 'Pending Approval',
        body: 'Your new marketing campaign requires manager approval.',
        entityType: 'campaign',
        entityId: null,
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 60),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60), // 2.5 days ago
      },

      // User2 notifications
      ...(user2
        ? [
            {
              tenantId: tenant.id,
              userId: user2.id,
              type: 'deal_assigned',
              title: 'New Deal Assigned',
              body: 'You have been assigned to Enterprise Account deal.',
              entityType: 'deal',
              entityId: null,
              isRead: false,
              createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
            },
            {
              tenantId: tenant.id,
              userId: user2.id,
              type: 'task_due',
              title: 'Task Due Soon',
              body: 'Follow up with client is due in 2 hours.',
              entityType: 'task',
              entityId: null,
              isRead: false,
              createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
            },
          ]
        : []),
    ];

    await prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    });

    console.log(`✅ Seeded ${notifications.length} notifications for ${tenant.name}`);
  }

  console.log('✅ Notification seed completed');
}
