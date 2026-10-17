"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignEngagementRate = campaignEngagementRate;
function campaignEngagementRate(campaign) {
    const sms = campaign.type.toUpperCase() === 'SMS';
    if (sms && campaign.smsTrackingVersion !== 1)
        return null;
    if (sms && (!campaign.sentCount || (campaign.clickedCount ?? 0) > campaign.sentCount))
        return null;
    return campaign.sentCount ? (sms ? campaign.clickedCount ?? 0 : campaign.openedCount ?? 0) / campaign.sentCount * 100 : 0;
}
