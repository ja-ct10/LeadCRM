'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useProductInterests, PRODUCT_INTEREST_ENDPOINT, type ProductInterestResponse } from '@/shared/hooks/use-product-interests';
import { apiClient } from '@/lib/api/client';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { toast } from 'sonner';
import { ClosingFieldsSettings } from './closing-fields-settings';
import { CustomFieldCard } from './custom-field-card';
export function ProductInterestsSettings() {
  const { products, enabled, loading, error, refresh } = useProductInterests();
  const router = useRouter();
  const canEdit = useHasPermission('settings.edit');
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    try { const result = await apiClient.post<ProductInterestResponse>(PRODUCT_INTEREST_ENDPOINT + '/field', {}); window.dispatchEvent(new CustomEvent('product-interests-changed', { detail: result })); toast.success('Product Interest field enabled.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to enable field.'); }
    finally { setBusy(false); }
  };
  return <ClosingFieldsSettings productCard={loading ? <TableLoadingState label="Loading Custom Fields" /> : error ? <p role="alert">{error}<Button onClick={refresh}>Retry</Button></p> :
      <CustomFieldCard title="Product Interest" description="Manage products and default Deal values for CRM records and forms." kind="product" status={enabled ? 'Enabled' : 'Disabled'} meta={`${products.length} ${products.length === 1 ? 'product' : 'products'}`} href={enabled ? '/settings?tab=products' : undefined} onClick={() => void enable()} disabled={!canEdit || busy}
        actions={enabled ? [{ id: 'manage', label: 'Manage products', onClick: () => router.push('/settings?tab=products') }] : canEdit ? [{ id: 'enable', label: busy ? 'Enabling…' : 'Enable field', disabled: busy, onClick: () => void enable() }] : []} />} />;
}
