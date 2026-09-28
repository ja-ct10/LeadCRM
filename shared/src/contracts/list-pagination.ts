/** List filters are applied before paging; multi-select values are comma-separated. */
export interface CampaignListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
}

export interface WorkflowListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  trigger?: string;
  isActive?: boolean;
  archived?: boolean;
}
