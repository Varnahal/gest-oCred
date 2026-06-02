import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface Borrower {
  id: string;
  name: string;
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  created_at?: string;
}

export interface Loan {
  id: string;
  borrower_id: string;
  amount: number; // Principal
  interest_rate: number; // monthly %
  installments_count: number;
  start_date: string;
  payment_frequency: 'monthly' | 'weekly';
  interest_type: 'simple' | 'compound';
  status: 'active' | 'completed' | 'overdue';
  created_at?: string;
}

export interface PaymentByInstallment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_at?: string;
}

// SQL Schema for Supabase Editor:
export const SQL_SCHEMA = `-- Copie e cole este script no Editor SQL (SQL Editor) do seu projeto Supabase para criar as tabelas necessárias:

-- 1. Criar tabela de clientes (Borrowers)
create table if not exists public.borrowers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  document text not null,
  phone text not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS (opcional, por simplicidade no teste de API você pode desativar ou criar políticas públicas)
alter table public.borrowers enable row level security;
create policy "Acesso público borrowers" on public.borrowers for all using (true) with check (true);

-- 2. Criar tabela de empréstimos (Loans)
create table if not exists public.loans (
  id uuid default gen_random_uuid() primary key,
  borrower_id uuid references public.borrowers(id) on delete cascade not null,
  amount double precision not null,
  interest_rate double precision not null,
  installments_count integer not null,
  start_date date not null,
  payment_frequency text not null,
  interest_type text not null,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.loans enable row level security;
create policy "Acesso público loans" on public.loans for all using (true) with check (true);

-- 3. Criar tabela de parcelas (Payments)
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  loan_id uuid references public.loans(id) on delete cascade not null,
  installment_number integer not null,
  due_date date not null,
  amount double precision not null,
  status text not null,
  paid_at date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payments enable row level security;
create policy "Acesso público payments" on public.payments for all using (true) with check (true);
`;

class DbService {
  private client: SupabaseClient | null = null;
  private isSupabaseActive = false;

  constructor() {
    this.init();
  }

  public init() {
    const url = localStorage.getItem('supabase_url') || (import.meta as any).env?.VITE_SUPABASE_URL;
    const key = localStorage.getItem('supabase_key') || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    
    const isValidUrl = url && url !== '' && url !== 'MY_SUPABASE_URL';
    const isValidKey = key && key !== '' && key !== 'MY_SUPABASE_ANON_KEY';

    if (isValidUrl && isValidKey) {
      try {
        this.client = createClient(url, key);
        this.isSupabaseActive = true;
      } catch (err) {
        console.error('Falha ao inicializar o cliente Supabase:', err);
        this.client = null;
        this.isSupabaseActive = false;
      }
    } else {
      this.client = null;
      this.isSupabaseActive = false;
    }
  }

  public isConnected(): boolean {
    return this.isSupabaseActive && this.client !== null;
  }

  // --- LocalStorage Fallbacks ---
  private getLocal<T>(key: string): T[] {
    const data = localStorage.getItem(`loan_app_${key}`);
    return data ? JSON.parse(data) : [];
  }

  private setLocal<T>(key: string, data: T[]) {
    localStorage.setItem(`loan_app_${key}`, JSON.stringify(data));
  }

  // --- BORROWERS API ---
  async getBorrowers(): Promise<Borrower[]> {
    if (this.isConnected()) {
      try {
        const { data, error } = await this.client!
          .from('borrowers')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Instabilidade no Supabase, usando dados locais de Clientes:', err);
      }
    }
    return this.getLocal<Borrower>('borrowers').sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveBorrower(borrower: Omit<Borrower, 'created_at'>): Promise<Borrower> {
    const newBorrower: Borrower = {
      ...borrower,
      created_at: new Date().toISOString(),
    };

    if (this.isConnected()) {
      try {
        const { data, error } = await this.client!
          .from('borrowers')
          .insert([borrower])
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error('Erro ao salvar no Supabase, salvando localmente:', err);
      }
    }

    const localList = this.getLocal<Borrower>('borrowers');
    const existingIndex = localList.findIndex(b => b.id === borrower.id);
    if (existingIndex > -1) {
      localList[existingIndex] = newBorrower;
    } else {
      localList.push(newBorrower);
    }
    this.setLocal('borrowers', localList);
    return newBorrower;
  }

  async deleteBorrower(id: string): Promise<boolean> {
    if (this.isConnected()) {
      try {
        const { error } = await this.client!
          .from('borrowers')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao deletar cliente no Supabase, fazendo exclusão local:', err);
      }
    }

    // Always keep local in sync
    const borrowers = this.getLocal<Borrower>('borrowers').filter(b => b.id !== id);
    this.setLocal('borrowers', borrowers);

    // Also delete associated loans and payments locally
    const loans = this.getLocal<Loan>('loans');
    const loansToDelete = loans.filter(l => l.borrower_id === id);
    this.setLocal('loans', loans.filter(l => l.borrower_id !== id));

    const loanIds = loansToDelete.map(l => l.id);
    const payments = this.getLocal<PaymentByInstallment>('payments');
    this.setLocal('payments', payments.filter(p => !loanIds.includes(p.loan_id)));

    return true;
  }

  // --- LOANS API ---
  async getLoans(): Promise<Loan[]> {
    if (this.isConnected()) {
      try {
        const { data, error } = await this.client!
          .from('loans')
          .select('*')
          .order('start_date', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Instabilidade no Supabase, usando dados locais de Empréstimos:', err);
      }
    }
    return this.getLocal<Loan>('loans').sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }

  async saveLoan(loan: Loan, paymentsList: PaymentByInstallment[]): Promise<Loan> {
    if (this.isConnected()) {
      try {
        // Save loan first
        const { data, error } = await this.client!
          .from('loans')
          .insert([loan])
          .select();
        if (error) throw error;

        // Save payments
        const { error: paymentsError } = await this.client!
          .from('payments')
          .insert(paymentsList);
        if (paymentsError) throw paymentsError;

        if (data && data[0]) return data[0];
      } catch (err) {
        console.error('Erro ao salvar empréstimo no Supabase, gravando localmente:', err);
      }
    }

    // Save locally
    const loans = this.getLocal<Loan>('loans');
    loans.push(loan);
    this.setLocal('loans', loans);

    const payments = this.getLocal<PaymentByInstallment>('payments');
    payments.push(...paymentsList);
    this.setLocal('payments', payments);

    return loan;
  }

  async deleteLoan(id: string): Promise<boolean> {
    if (this.isConnected()) {
      try {
        const { error } = await this.client!
          .from('loans')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao deletar empréstimo no Supabase:', err);
      }
    }

    const loans = this.getLocal<Loan>('loans').filter(l => l.id !== id);
    this.setLocal('loans', loans);

    const payments = this.getLocal<PaymentByInstallment>('payments').filter(p => p.loan_id !== id);
    this.setLocal('payments', payments);

    return true;
  }

  async updateLoanStatus(id: string, status: 'active' | 'completed' | 'overdue'): Promise<boolean> {
    if (this.isConnected()) {
      try {
        const { error } = await this.client!
          .from('loans')
          .update({ status })
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Erro ao atualizar status do empréstimo no Supabase:', err);
      }
    }

    const loans = this.getLocal<Loan>('loans');
    const index = loans.findIndex(l => l.id === id);
    if (index > -1) {
      loans[index].status = status;
      this.setLocal('loans', loans);
    }
    return true;
  }

  // --- PAYMENTS API ---
  async getPayments(): Promise<PaymentByInstallment[]> {
    if (this.isConnected()) {
      try {
        const { data, error } = await this.client!
          .from('payments')
          .select('*')
          .order('due_date', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Instabilidade no Supabase, usando parcelas locais:', err);
      }
    }
    return this.getLocal<PaymentByInstallment>('payments').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  async updatePayment(payment: PaymentByInstallment): Promise<PaymentByInstallment> {
    if (this.isConnected()) {
      try {
        const { data, error } = await this.client!
          .from('payments')
          .update({
            status: payment.status,
            paid_at: payment.paid_at,
          })
          .eq('id', payment.id)
          .select();
        if (error) throw error;
        if (data && data[0]) return data[0];
      } catch (err) {
        console.error('Erro ao atualizar parcela no Supabase:', err);
      }
    }

    const payments = this.getLocal<PaymentByInstallment>('payments');
    const index = payments.findIndex(p => p.id === payment.id);
    if (index > -1) {
      payments[index] = payment;
      this.setLocal('payments', payments);
    }

    // Check if all payments of this loan are completed
    this.checkAndCloseLoan(payment.loan_id);

    return payment;
  }

  private async checkAndCloseLoan(loanId: string) {
    const payments = this.getLocal<PaymentByInstallment>('payments').filter(p => p.loan_id === loanId);
    const hasPending = payments.some(p => p.status !== 'paid');
    const newStatus = hasPending ? 'active' : 'completed';
    await this.updateLoanStatus(loanId, newStatus);
  }

  // --- DATA SYNCHRONIZATION ---
  async syncLocalToSupabase(): Promise<{ borrowersCount: number; loansCount: number; paymentsCount: number }> {
    if (!this.isConnected()) {
      throw new Error('Supabase não conectado. Configure as credenciais primeiro.');
    }

    const localBorrowers = this.getLocal<Borrower>('borrowers');
    const localLoans = this.getLocal<Loan>('loans');
    const localPayments = this.getLocal<PaymentByInstallment>('payments');

    let bibIn = 0;
    let loaIn = 0;
    let payIn = 0;

    // 1. Upload Clients
    if (localBorrowers.length > 0) {
      const { error: bErr } = await this.client!
        .from('borrowers')
        .upsert(localBorrowers, { onConflict: 'id' });
      if (bErr) throw new Error(`Falha ao sincronizar Clientes: ${bErr.message}`);
      bibIn = localBorrowers.length;
    }

    // 2. Upload Loans
    if (localLoans.length > 0) {
      const { error: lErr } = await this.client!
        .from('loans')
        .upsert(localLoans, { onConflict: 'id' });
      if (lErr) throw new Error(`Falha ao sincronizar Empréstimos: ${lErr.message}`);
      loaIn = localLoans.length;
    }

    // 3. Upload Payments
    if (localPayments.length > 0) {
      const { error: pErr } = await this.client!
        .from('payments')
        .upsert(localPayments, { onConflict: 'id' });
      if (pErr) throw new Error(`Falha ao sincronizar Parcelas: ${pErr.message}`);
      payIn = localPayments.length;
    }

    return { borrowersCount: bibIn, loansCount: loaIn, paymentsCount: payIn };
  }

  async syncSupabaseToLocal(): Promise<{ borrowersCount: number; loansCount: number; paymentsCount: number }> {
    if (!this.isConnected()) {
      throw new Error('Supabase não conectado. Configure as credenciais primeiro.');
    }

    // Fetch all from Supabase
    const { data: dbB, error: bErr } = await this.client!.from('borrowers').select('*');
    if (bErr) throw bErr;

    const { data: dbL, error: lErr } = await this.client!.from('loans').select('*');
    if (lErr) throw lErr;

    const { data: dbP, error: pErr } = await this.client!.from('payments').select('*');
    if (pErr) throw pErr;

    // Overwrite local
    this.setLocal('borrowers', dbB || []);
    this.setLocal('loans', dbL || []);
    this.setLocal('payments', dbP || []);

    return {
      borrowersCount: (dbB || []).length,
      loansCount: (dbL || []).length,
      paymentsCount: (dbP || []).length
    };
  }
}

export const db = new DbService();
