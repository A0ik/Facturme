import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type OpportunityStage = 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Opportunity {
  id: string;
  user_id: string;
  client_id?: string | null;
  client_name: string;
  title: string;
  value: number;
  stage: OpportunityStage;
  probability: number;
  expected_close_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

interface CrmState {
  opportunities: Opportunity[];
  loading: boolean;
  fetchOpportunities: () => Promise<void>;
  createOpportunity: (data: OpportunityInput) => Promise<Opportunity>;
  updateOpportunity: (id: string, data: Partial<OpportunityInput>) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  clearData: () => void;
}

export const useCrmStore = create<CrmState>((set, get) => ({
  opportunities: [],
  loading: false,

  clearData: () => set({ opportunities: [] }),

  fetchOpportunities: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[crmStore] fetchOpportunities:', error);
        return;
      }
      set({ opportunities: data || [] });
    } finally {
      set({ loading: false });
    }
  },

  createOpportunity: async (input) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Non authentifié');

    const { data, error } = await supabase
      .from('opportunities')
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    set((s) => ({ opportunities: [data, ...s.opportunities] }));
    return data;
  },

  updateOpportunity: async (id, updates) => {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    set((s) => ({
      opportunities: s.opportunities.map((o) => (o.id === id ? data : o)),
    }));
  },

  deleteOpportunity: async (id) => {
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ opportunities: s.opportunities.filter((o) => o.id !== id) }));
  },
}));
