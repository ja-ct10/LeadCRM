'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useProductInterests, PRODUCT_INTEREST_ENDPOINT, type ProductInterestResponse } from '@/shared/hooks/use-product-interests';
import { apiClient } from '@/lib/api/client';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { toast } from 'sonner';
export function ProductInterestsSettings() {
  const { enabled, loading, error, refresh } = useProductInterests();
  const canEdit = useHasPermission('settings.edit');
  const [busy, setBusy] = useState(false);
  return <div className="space-y-5">
    <h2 className="text-xl font-semibold">Custom Fields</h2>
    {loading ? <TableLoadingState label="Loading Custom Fields" /> : error ? <p role="alert">{error}<Button onClick={refresh}>Retry</Button></p> :
      <article className="max-w-md rounded-lg border border-border bg-card p-5 space-y-3">
        <Tag size={28} /><h3 className="font-semibold">Product Interest</h3>
        <p className="text-sm text-muted-foreground">{enabled ? 'Product selection field for CRM records and forms.' : 'Enable the Product Interest field for CRM records and forms.'}</p>
        {enabled ? <Link className="text-sm text-primary underline" href="/settings?tab=products">Manage products and default Deal values in Products</Link> : canEdit &&
          <Button disabled={busy} onClick={async () => { setBusy(true); try { const result = await apiClient.post<ProductInterestResponse>(PRODUCT_INTEREST_ENDPOINT + '/field', {}); window.dispatchEvent(new CustomEvent('product-interests-changed', { detail: result })); toast.success('Product Interest field enabled.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to enable field.'); } finally { setBusy(false); } }}>Add Product Interest field</Button>}
      </article>}
  </div>;
}
