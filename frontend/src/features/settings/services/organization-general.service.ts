import { api } from '@/lib/api';

export interface OrganizationGeneralSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  browserTabTitle: string | null;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationGeneralInput {
  name?: string;
  logoUrl?: string | null;
  browserTabTitle?: string | null;
}

export const organizationGeneralService = {
  async get(): Promise<OrganizationGeneralSettings> {
    const { data } = await api.get('/organizations/current');
    return data.data ?? data;
  },

  async update(
    input: UpdateOrganizationGeneralInput,
  ): Promise<OrganizationGeneralSettings> {
    const { data } = await api.patch('/organizations/current', input);
    return data.data ?? data;
  },
};
