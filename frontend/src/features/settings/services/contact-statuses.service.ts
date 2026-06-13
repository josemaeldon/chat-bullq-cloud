export interface ContactStatus {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  description: string | null;
  departmentId: string | null;
  sortOrder: number;
  department?: { id: string; name: string; color: string } | null;
  _count?: { contacts: number };
}

export interface CreateContactStatusPayload {
  name: string;
  color?: string;
  description?: string;
  departmentId?: string;
  sortOrder?: number;
}

export interface UpdateContactStatusPayload {
  name?: string;
  color?: string;
  description?: string;
  departmentId?: string | null;
  sortOrder?: number;
}

export const CONTACT_STATUSES_SUPPORTED = false;

function unsupportedError() {
  return new Error(
    'Status de contato não está disponível nesta versão do backend.',
  );
}

export const contactStatusesService = {
  async list(): Promise<ContactStatus[]> {
    return [];
  },
  async create(payload: CreateContactStatusPayload): Promise<ContactStatus> {
    void payload;
    throw unsupportedError();
  },
  async update(
    id: string,
    payload: UpdateContactStatusPayload,
  ): Promise<ContactStatus> {
    void id;
    void payload;
    throw unsupportedError();
  },
  async remove(id: string): Promise<void> {
    void id;
    throw unsupportedError();
  },
  /** statusId=null limpa o status do contato */
  async setContactStatus(contactId: string, statusId: string | null) {
    void contactId;
    void statusId;
    throw unsupportedError();
  },
};
