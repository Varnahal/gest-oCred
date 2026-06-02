import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  Database, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Search, 
  Check, 
  ChevronRight, 
  ArrowLeft,
  Copy,
  ExternalLink,
  Smartphone,
  Mail,
  FileText,
  Clock,
  Info,
  Settings,
  X,
  CreditCard
} from 'lucide-react';
import { db, Borrower, Loan, PaymentByInstallment, SQL_SCHEMA } from './db.ts';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'loans' | 'borrowers' | 'database'>('dashboard');
  
  // Data State
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<PaymentByInstallment[]>([]);
  
  // System State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedLoanPayments, setSelectedLoanPayments] = useState<PaymentByInstallment[]>([]);
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');

  // Input States (Pristine clean states - no template boilerplate model data populated)
  const [showAddBorrower, setShowAddBorrower] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // New Client Form State
  const [newBorrower, setNewBorrower] = useState({
    name: '',
    document: '',
    phone: '',
    email: ''
  });

  // New Loan Form State
  const [newLoan, setNewLoan] = useState({
    borrower_id: '',
    amount: 1000,
    interest_rate: 10,
    installments_count: 5,
    start_date: new Date().toISOString().substring(0, 10),
    payment_frequency: 'monthly' as 'monthly' | 'weekly',
    interest_type: 'simple' as 'simple' | 'compound',
    notes: ''
  });

  // Supabase direct connection credential states (Saved in localStorage on db.ts)
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('supabase_key') || '');
  const [isConnectionSaved, setIsConnectionSaved] = useState(false);

  // Generate installments list
  const calculatePaymentsList = (
    loanId: string,
    amount: number,
    interestRate: number,
    interestType: 'simple' | 'compound',
    installmentsCount: number,
    startDateStr: string,
    paymentFrequency: 'monthly' | 'weekly'
  ): PaymentByInstallment[] => {
    const list: PaymentByInstallment[] = [];
    const start = new Date(startDateStr || new Date().toISOString().substring(0, 10));

    let totalToRepay = amount;
    if (interestType === 'simple' && interestRate > 0) {
      // Flat fixed rate
      const totalInterest = amount * (interestRate / 100);
      totalToRepay = amount + totalInterest;
    } else if (interestType === 'compound' && interestRate > 0) {
      // Compounded monthly
      const totalInterest = amount * (Math.pow(1 + interestRate / 100, installmentsCount) - 1);
      totalToRepay = amount + totalInterest;
    }

    const installmentAmount = Number((totalToRepay / installmentsCount).toFixed(2));

    for (let i = 1; i <= installmentsCount; i++) {
      const dueDate = new Date(start);
      if (paymentFrequency === 'weekly') {
        dueDate.setDate(start.getDate() + (i * 7));
      } else {
        dueDate.setMonth(start.getMonth() + i);
      }

      const yyyy = dueDate.getFullYear();
      const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dd = String(dueDate.getDate()).padStart(2, '0');
      const formattedDueDate = `${yyyy}-${mm}-${dd}`;

      list.push({
        id: crypto.randomUUID ? crypto.randomUUID() : 'inst_' + Math.random().toString(36).substring(2, 9),
        loan_id: loanId,
        installment_number: i,
        due_date: formattedDueDate,
        amount: installmentAmount,
        status: 'pending'
      });
    }

    // Cent rounding adjustments
    const sumCalculated = installmentAmount * installmentsCount;
    const difference = Number((totalToRepay - sumCalculated).toFixed(2));
    if (difference !== 0 && list.length > 0) {
      list[list.length - 1].amount = Number((list[list.length - 1].amount + difference).toFixed(2));
    }

    return list;
  };

  // Sync data dynamically from database backend
  const loadWorkspaceData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const dbBorrowers = await db.getBorrowers();
      setBorrowers(dbBorrowers);

      const dbLoans = await db.getLoans();
      setLoans(dbLoans);

      const dbPayments = await db.getPayments();
      setPayments(dbPayments);

      // Refresh side menu status
      if (selectedLoan) {
        const freshLoan = dbLoans.find(l => l.id === selectedLoan.id);
        if (freshLoan) {
          setSelectedLoan(freshLoan);
          const freshPayments = dbPayments.filter(p => p.loan_id === freshLoan.id);
          setSelectedLoanPayments(freshPayments);
        } else {
          setSelectedLoan(null);
          setSelectedLoanPayments([]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Não foi possível carregar o banco de dados. " + (err.message || "Verifique as configurações do Supabase."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  // Save manual connection credentials
  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (supabaseUrl.trim() && supabaseKey.trim()) {
      localStorage.setItem('supabase_url', supabaseUrl.trim());
      localStorage.setItem('supabase_key', supabaseKey.trim());
      db.init(); // Restart DB configuration
      setIsConnectionSaved(true);
      setTimeout(() => setIsConnectionSaved(false), 2000);
      loadWorkspaceData();
    } else {
      alert("Por favor, preencha a URL e a Chave de Acesso Anon para prosseguir.");
    }
  };

  const handleClearConnection = () => {
    if (window.confirm("Deseja desconectar o Supabase? Aplicativo voltará a usar banco de dados LocalStorage.")) {
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_key');
      setSupabaseUrl('');
      setSupabaseKey('');
      db.init(); // Restart local fallback mode
      loadWorkspaceData();
    }
  };

  // Create Borrower Submission
  const handleCreateBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBorrower.name.trim()) return;

    try {
      const payload: Borrower = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'b_' + Math.random().toString(36).substring(2, 9),
        name: newBorrower.name.trim(),
        document: newBorrower.document.trim(),
        phone: newBorrower.phone.trim(),
        email: newBorrower.email.trim()
      };

      await db.saveBorrower(payload);
      setNewBorrower({ name: '', document: '', phone: '', email: '' });
      setShowAddBorrower(false);
      await loadWorkspaceData();
    } catch (err: any) {
      alert("Erro ao salvar cliente: " + err.message);
    }
  };

  // Create Loan Submission & Installments Plan
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoan.borrower_id) {
      alert("Selecione um cliente para prosseguir.");
      return;
    }

    try {
      const loanId = crypto.randomUUID ? crypto.randomUUID() : 'loan_' + Math.random().toString(36).substring(2, 9);
      
      // Calculate installment plan
      const generatedPayments = calculatePaymentsList(
        loanId,
        Number(newLoan.amount),
        Number(newLoan.interest_rate),
        newLoan.interest_type,
        Number(newLoan.installments_count),
        newLoan.start_date,
        newLoan.payment_frequency
      );

      const loanPayload: Loan = {
        id: loanId,
        borrower_id: newLoan.borrower_id,
        amount: Number(newLoan.amount),
        interest_rate: Number(newLoan.interest_rate),
        installments_count: Number(newLoan.installments_count),
        start_date: newLoan.start_date,
        payment_frequency: newLoan.payment_frequency,
        interest_type: newLoan.interest_type,
        status: 'active'
      };

      await db.saveLoan(loanPayload, generatedPayments);
      
      // Clear forms
      setNewLoan({
        borrower_id: '',
        amount: 1000,
        interest_rate: 10,
        installments_count: 5,
        start_date: new Date().toISOString().substring(0, 10),
        payment_frequency: 'monthly',
        interest_type: 'simple',
        notes: ''
      });
      setShowAddLoan(false);
      await loadWorkspaceData();
      
      // Auto open detail of created loan
      const reLoadedLoans = await db.getLoans();
      const createdLoan = reLoadedLoans.find(l => l.id === loanId);
      if (createdLoan) {
        setSelectedLoan(createdLoan);
        const relativePayments = generatedPayments;
        setSelectedLoanPayments(relativePayments);
      }
    } catch (err: any) {
      alert("Erro ao registrar empréstimo: " + err.message);
    }
  };

  // Toggle Installment checklist
  const handleTogglePayment = async (inst: PaymentByInstallment) => {
    try {
      const updatedStatus = inst.status === 'paid' ? 'pending' : 'paid';
      const updatedPaidAt = updatedStatus === 'paid' ? new Date().toISOString().substring(0, 10) : undefined;
      
      const payload: PaymentByInstallment = {
        ...inst,
        status: updatedStatus,
        paid_at: updatedPaidAt
      };

      await db.updatePayment(payload);
      await loadWorkspaceData();
    } catch (err: any) {
      alert("Erro de atualização da parcela: " + err.message);
    }
  };

  // Delete Borrower Client
  const handleDeleteBorrower = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${name}"? ATENÇÃO: Isso excluirá também todos os empréstimos e parcelas geradas!`)) {
      return;
    }

    try {
      await db.deleteBorrower(id);
      await loadWorkspaceData();
    } catch (err: any) {
      alert("Erro ao remover cliente: " + err.message);
    }
  };

  // Delete Contract Loan
  const handleDeleteLoan = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este empréstimo e todas as parcelas permanentemente?")) {
      return;
    }

    try {
      await db.deleteLoan(id);
      setSelectedLoan(null);
      setSelectedLoanPayments([]);
      await loadWorkspaceData();
    } catch (err: any) {
      alert("Erro ao remover empréstimo: " + err.message);
    }
  };

  // Clipboard Copier
  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Real-Time Dynamic Financial Metrics
  const getMetrics = () => {
    let totalLent = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    const clientsWithActiveSet = new Set<string>();

    loans.forEach(l => {
      totalLent += Number(l.amount);
      if (l.status === 'active' || l.status === 'overdue') {
        clientsWithActiveSet.add(l.borrower_id);
      }
    });

    payments.forEach(p => {
      if (p.status === 'paid') {
        totalCollected += Number(p.amount);
      } else {
        totalOutstanding += Number(p.amount);
        
        // Analyze due date
        const dSplit = p.due_date.split('-');
        const due = new Date(Number(dSplit[0]), Number(dSplit[1]) - 1, Number(dSplit[2]));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (due < today) {
          totalOverdue += Number(p.amount);
        }
      }
    });

    const expectedTotalRepay = totalLent + loans.reduce((interestSum, l) => {
      if (l.interest_type === 'simple') {
        return interestSum + (l.amount * (l.interest_rate / 100));
      } else if (l.interest_type === 'compound') {
        return interestSum + (l.amount * (Math.pow(1 + l.interest_rate / 100, l.installments_count) - 1));
      }
      return interestSum;
    }, 0);

    const expectedGain = expectedTotalRepay - totalLent;

    return {
      totalLent,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      activeClientsCount: clientsWithActiveSet.size,
      expectedGain,
      expectedTotalRepay
    };
  };

  const metrics = getMetrics();

  // Search filter implementation
  const filteredLoans = loans.filter(l => {
    const borrower = borrowers.find(b => b.id === l.borrower_id);
    const clientName = borrower?.name || '';
    const clientDoc = borrower?.document || '';
    
    const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          clientDoc.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Simulator stats preview card (Inside loan form)
  const previewPayments = calculatePaymentsList(
    'sim',
    Number(newLoan.amount),
    Number(newLoan.interest_rate),
    newLoan.interest_type,
    Number(newLoan.installments_count),
    newLoan.start_date,
    newLoan.payment_frequency
  );

  const previewSum = previewPayments.reduce((acc, current) => acc + current.amount, 0);
  const previewInterestGain = Number((previewSum - newLoan.amount).toFixed(2));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="loan_application_layout_wrapper">
      
      {/* PROFESSIONAL NAVBAR HEADER */}
      <header className="w-full bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40" id="header_navigation_main">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3" id="brand_badge_logo_area">
            <div className="p-2 bg-indigo-600 rounded-lg text-white" id="brand_icon_circle">
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-950 tracking-tight" id="main_logo_heading">GestãoCred</h1>
              <p className="text-xs text-slate-500 font-medium pb-0.5">Gestão e Controle de Empréstimos</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5" id="header_database_indicator_badge">
            {db.isConnected() ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-250 px-3 py-1 rounded-full text-xs font-semibold" id="badge_connected_supabase">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Supabase Ativo
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-semibold" id="badge_offline_local">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Banco Local
              </div>
            )}
            
            <button
              onClick={() => setActiveTab('database')}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition-colors"
              title="Configurar Conexão"
              id="cog_configure_db_btn"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ERROR FEEDBACK BANNER */}
      {errorMessage && (
        <div className="bg-red-50 border-y border-red-200 text-red-950 px-4 py-3" id="database_error_panel">
          <div className="max-w-7xl mx-auto flex items-start gap-3 text-xs">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold">Aviso de Operação:</span> {errorMessage}
              <button 
                onClick={() => setActiveTab('database')}
                className="ml-2 font-black underline text-indigo-600 hover:text-indigo-800"
              >
                Configurar credenciais de acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CENTRAL AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6" id="dashboard_main_viewport">
        
        {/* TABS MENU */}
        <div className="flex border-b border-slate-200 gap-6 text-sm" id="control_navbar_panel_links">
          <button
            id="nav_btn_dashboard"
            onClick={() => { setActiveTab('dashboard'); setSelectedLoan(null); }}
            className={`pb-3 font-semibold relative transition-all ${
              activeTab === 'dashboard' ? 'text-indigo-600 border-b-2 border-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Resumo Operacional
          </button>
          <button
            id="nav_btn_loans"
            onClick={() => { setActiveTab('loans'); }}
            className={`pb-3 font-semibold relative transition-all ${
              activeTab === 'loans' ? 'text-indigo-600 border-b-2 border-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Contratos ({loans.length})
          </button>
          <button
            id="nav_btn_borrowers"
            onClick={() => { setActiveTab('borrowers'); setSelectedLoan(null); }}
            className={`pb-3 font-semibold relative transition-all ${
              activeTab === 'borrowers' ? 'text-indigo-600 border-b-2 border-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Lista de Clientes ({borrowers.length})
          </button>
        </div>

        {/* ----------------- TAB: RESUMO OPERACIONAL (DASHBOARD) ----------------- */}
        {activeTab === 'dashboard' && !selectedLoan && (
          <div className="flex flex-col gap-6" id="view_mode_dashboard">
            
            {/* CORE EXECUTIVE STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="executive_dashboard_kpi_grid">
              
              {/* STAT: CAPITAL LENT */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between" id="metric_box_total_lent">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Capital Emprestado</p>
                  <p className="text-2xl font-black text-slate-950 tracking-tight">
                    {metrics.totalLent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Soma total dos valores concedidos</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <DollarSign size={22} />
                </div>
              </div>

              {/* STAT: RETORNO COMPENSADO */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between" id="metric_box_total_collected">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Recebido</p>
                  <p className="text-2xl font-black text-emerald-600 tracking-tight">
                    {metrics.totalCollected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Soma das parcelas compensadas</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={22} />
                </div>
              </div>

              {/* STAT: RUNNING BALANCE */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between" id="metric_box_outstanding_balance">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo em Aberto</p>
                  <p className="text-2xl font-black text-indigo-950 tracking-tight">
                    {metrics.totalOutstanding.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Valor pendente de amortização</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                  <TrendingUp size={22} />
                </div>
              </div>

              {/* STAT: COMPENSATIONS OVERDUE */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between" id="metric_box_overdue_warning">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Vencido</p>
                  <p className={`text-2xl font-black tracking-tight ${metrics.totalOverdue > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {metrics.totalOverdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Parcelas com data vencida</p>
                </div>
                <div className={`p-3 rounded-xl ${metrics.totalOverdue > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                  <AlertTriangle size={22} />
                </div>
              </div>

            </div>

            {/* PERFORMANCE ANALYSIS PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard_charts_and_meters_grid">
              
              {/* ACCRUED GAINS ESTIMATE */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl md:col-span-2 flex flex-col gap-4" id="forecast_profitability_box">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <TrendingUp size={16} className="text-emerald-500" />
                  Performance de Juros e Margem de Lucro
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Geral Estimado a Receber</span>
                    <p className="text-lg font-extrabold text-slate-850 mt-0.5">
                      {metrics.expectedTotalRepay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
                    <span className="text-[10px] text-teal-700 uppercase font-black tracking-wider block">Lucratividade Contratada (Juros)</span>
                    <p className="text-lg font-extrabold text-teal-950 mt-0.5">
                      {metrics.expectedGain.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>

                {/* Progress bar of loan collections */}
                <div className="mt-2 text-xs">
                  <div className="flex justify-between font-bold mb-1 text-slate-700">
                    <span>Retorno Realizado:</span>
                    <span className="text-emerald-600">
                      {metrics.expectedTotalRepay > 0 
                        ? ((metrics.totalCollected / metrics.expectedTotalRepay) * 100).toFixed(1)
                        : '0'}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ 
                        width: `${metrics.expectedTotalRepay > 0 
                          ? Math.min(100, (metrics.totalCollected / metrics.expectedTotalRepay) * 100) 
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-450 mt-1">
                    <span>{metrics.totalCollected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} recebidos</span>
                    <span>{metrics.expectedTotalRepay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} esperados</span>
                  </div>
                </div>
              </div>

              {/* CONTROLS PROFILE & DEFAULT RISKS */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col justify-between" id="default_risk_tracker_box">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Balanço de Inadimplência
                  </h3>
                  
                  <div className="text-center py-4">
                    <span className={`text-4xl font-extrabold tracking-tight ${metrics.totalOutstanding > 0 && (metrics.totalOverdue / metrics.totalOutstanding) > 0.15 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                      {metrics.totalOutstanding > 0 
                        ? ((metrics.totalOverdue / metrics.totalOutstanding) * 100).toFixed(1) 
                        : '0.0'}%
                    </span>
                    <p className="text-[10px] text-slate-450 mt-1.5 uppercase font-bold tracking-wider">Compensações de risco ativo</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">Distribuição de Contratos:</span>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span> 
                      {loans.filter(l => l.status === 'active').length} Contrato(s) ativo(s)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> 
                      {loans.filter(l => l.status === 'completed').length} Contrato(s) pago(s)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> 
                      {loans.filter(l => l.status === 'overdue').length} Contrato(s) vencido(s)
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* FLOATING ACTION TRIGGER BAR */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl" id="floating_action_shortcut_strip">
              <div>
                <h4 className="font-extrabold text-indigo-950 text-sm">Operações Rápidas</h4>
                <p className="text-xs text-indigo-700 mt-0.5">Cadastre tomadores de capital e determine parcelas simuladas em tempo real.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  id="action_btn_add_client_dash"
                  onClick={() => { setShowAddBorrower(true); setShowAddLoan(false); }}
                  className="px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Plus size={14} /> Registrar Cliente
                </button>
                <button
                  id="action_btn_add_loan_dash"
                  onClick={() => { 
                    if (borrowers.length === 0) {
                      alert("Antes de conceder um empréstimo, você precisa cadastrar pelo menos um Cliente.");
                      setShowAddBorrower(true);
                    } else {
                      setShowAddLoan(true); 
                      setShowAddBorrower(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5"
                >
                  <Plus size={14} /> Conceder Empréstimo
                </button>
              </div>
            </div>

            {/* DASHBOARD BOTTOM SUMMARY BLOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard_summary_recent_tables">
              
              {/* RECENT CONTRACTS */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm lg:col-span-2 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 animate-fade-in">
                    <FileText size={16} className="text-indigo-600" />
                    Últimos Contratos Emitidos
                  </h3>
                  <button 
                    onClick={() => setActiveTab('loans')} 
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Ver Tudo
                  </button>
                </div>

                {loans.length === 0 ? (
                  <div className="py-12 text-center rounded-lg bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <FileText size={40} className="text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">Nenhum contrato ativo</p>
                    <p className="text-[10px] text-slate-400 mt-1">Conceda um empréstimo novo para ter as parcelas e clientes mostrados aqui.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                          <th className="py-2">Devedor</th>
                          <th className="py-2">Capital</th>
                          <th className="py-2">Taxa</th>
                          <th className="py-2">Parcelas</th>
                          <th className="py-2">Status</th>
                          <th className="py-2 text-right">Amortização</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.slice(0, 5).map(l => {
                          const client = borrowers.find(b => b.id === l.borrower_id);
                          const clientPayments = payments.filter(p => p.loan_id === l.id);
                          const paidCount = clientPayments.filter(p => p.status === 'paid').length;
                          
                          return (
                            <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 font-medium">
                              <td className="py-3">
                                <span className="font-bold text-slate-900 block">{client?.name || 'Cliente excluído'}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{client?.document || 'N/D'}</span>
                              </td>
                              <td className="py-3 font-bold text-slate-900">
                                {l.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="py-3 text-slate-600">{l.interest_rate}% ({l.interest_type === 'simple' ? 'Simp' : 'Comp'})</td>
                              <td className="py-3 font-mono">{l.installments_count} parcelas</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase inline-block ${
                                  l.status === 'completed' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : l.status === 'overdue' 
                                      ? 'bg-red-50 text-red-700 border border-red-200' 
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {l.status === 'completed' ? 'Liquidado' : l.status === 'overdue' ? 'Vencido' : 'Em Aberto'}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedLoan(l);
                                    setSelectedLoanPayments(clientPayments);
                                    setActiveTab('loans');
                                  }}
                                  className="px-2 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-all inline-flex items-center gap-0.5"
                                >
                                  Ver <ChevronRight size={10} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

              {/* RECENT HIGHLIGHTED CLIENTS */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Users size={16} className="text-indigo-600" />
                    Tomadores de Capital ({borrowers.length})
                  </h3>
                  <button 
                    onClick={() => setActiveTab('borrowers')} 
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Gerenciar
                  </button>
                </div>

                {borrowers.length === 0 ? (
                  <div className="py-12 text-center rounded-lg bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Users size={40} className="text-slate-350 mb-2" />
                    <p className="text-xs font-bold text-slate-700">Sem clientes</p>
                    <p className="text-[10px] text-slate-400 mt-1">Ao cadastrar seu devedor inicial as parcelas estarão liberadas.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 text-xs font-medium read-only">
                    {borrowers.slice(0, 6).map(b => {
                      const clientLoans = loans.filter(l => l.borrower_id === b.id);
                      const hasOverdue = clientLoans.some(l => l.status === 'overdue');

                      return (
                        <div key={b.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                          <div>
                            <span className="font-bold text-slate-900 block">{b.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">CPF: {b.document || 'Não informado'}</span>
                          </div>
                          
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[9px] font-bold">
                              {clientLoans.length} empréstimo(s)
                            </span>
                            {hasOverdue && (
                              <span className="text-[8px] text-red-600 font-extrabold uppercase animate-pulse">⚠️ Inadimplente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ----------------- TAB: EMPRÉSTIMOS (CONTRATOS & BILLET DESK) ----------------- */}
        {activeTab === 'loans' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="contracts_administration_view">
            
            {/* COLUMN 1 & 2: CONTRACTS RECORD GRID */}
            <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="font-extrabold text-slate-950 text-base">Contratos Financeiros Emitidos ({filteredLoans.length})</h3>
                <button
                  id="navbar_action_btn_add_loan"
                  onClick={() => {
                    if (borrowers.length === 0) {
                      alert("Antes de criar um empréstimo, adicione pelo menos um Cliente.");
                      setShowAddBorrower(true);
                    } else {
                      setShowAddLoan(true);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold shadow flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} /> Novo Empréstimo
                </button>
              </div>

              {/* BAR: FILTERS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative sm:col-span-2">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-405" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome do devedor ou documento..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-none text-slate-700 font-bold"
                >
                  <option value="all">Ver Todos Contratos</option>
                  <option value="active">Apenas Ativos</option>
                  <option value="completed">Apenas Quitados</option>
                  <option value="overdue">Apenas Em Atraso</option>
                </select>
              </div>

              {/* LIST DISPLAY */}
              {filteredLoans.length === 0 ? (
                <div className="py-24 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                  <Layers size={40} className="text-slate-300 mb-3" />
                  <p className="text-xs font-bold text-slate-700">Nenhum contrato encontrado</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm">Tente limpar seus parâmetros ou conceda novos acordos.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredLoans.map(l => {
                    const client = borrowers.find(b => b.id === l.borrower_id);
                    const relativePayments = payments.filter(p => p.loan_id === l.id);
                    const paidCount = relativePayments.filter(p => p.status === 'paid').length;
                    const completionPercent = Math.round((paidCount / l.installments_count) * 100);

                    return (
                      <div
                        key={l.id}
                        onClick={() => {
                          setSelectedLoan(l);
                          setSelectedLoanPayments(relativePayments);
                        }}
                        className={`p-4 border rounded-xl transition-all cursor-pointer text-xs ${
                          selectedLoan?.id === l.id 
                            ? 'bg-indigo-50/40 border-indigo-400 shadow-sm' 
                            : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <span className="font-extrabold text-slate-900 text-sm block">{client?.name || 'Devedor excluído'}</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">Início: {l.start_date.split('-').reverse().join('/')}</span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block ${
                            l.status === 'completed' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                              : l.status === 'overdue' 
                                ? 'bg-red-50 text-red-700 border border-red-200' 
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                            {l.status === 'completed' ? 'Quitado' : l.status === 'overdue' ? 'VENCIDO ⚠️' : 'Ativo'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3 py-2 border-y border-slate-200/50">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">Consórcio Concedido:</span>
                            <span className="text-slate-850 font-extrabold">{l.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">Taxa Contratada:</span>
                            <span className="text-slate-850 font-bold">{l.interest_rate}% ({l.interest_type === 'simple' ? 'Fixo' : 'Comp'})</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">Amortização geral:</span>
                            <span className="text-slate-850 font-bold">{paidCount}/{l.installments_count} parcelas pagas</span>
                          </div>
                        </div>

                        {/* Progression bar */}
                        <div>
                          <div className="flex justify-between text-[10px] font-semibold text-slate-450 mb-1">
                            <span>Quitação total de capital</span>
                            <span>{completionPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                l.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`} 
                              style={{ width: `${completionPercent}%` }}
                            ></div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* COLUMN 3: SELECTED DETAILS & BILLING BILLET DESK */}
            <div className="lg:col-span-1">
              {selectedLoan ? (
                <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800 shadow-md sticky top-24 flex flex-col gap-5 text-xs font-medium" id="contract_billing_sidebar">
                  
                  {/* Title of sidebar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider block">Painel Financeiro</span>
                      <h4 className="text-base font-black text-white">{borrowers.find(b => b.id === selectedLoan.borrower_id)?.name || 'Devedor'}</h4>
                      <p className="text-[10px] text-slate-450 mt-0.5">CPF: {borrowers.find(b => b.id === selectedLoan.borrower_id)?.document || 'Não preenchido'}</p>
                    </div>

                    <button 
                      onClick={() => { setSelectedLoan(null); setSelectedLoanPayments([]); }}
                      className="p-1 bg-slate-800 text-slate-400 hover:text-white rounded"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  </div>

                  {/* WhatsApp contact tools */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <p className="text-[9px] text-slate-450 uppercase font-black tracking-wide block mb-1">Canais de Cobrança:</p>
                    {borrowers.find(b => b.id === selectedLoan.borrower_id)?.phone ? (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Smartphone size={12} className="text-slate-500" />
                        <span>Celular: {borrowers.find(b => b.id === selectedLoan.borrower_id)?.phone}</span>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[10px]">Sem celular cadastrado para cobranças.</p>
                    )}
                  </div>

                  {/* Installments checkout area */}
                  <div className="border-t border-slate-800 pt-3">
                    <h5 className="font-extrabold text-amber-500 text-[10px] uppercase tracking-wider mb-2">Parcelas do Plano:</h5>
                    
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1" id="installments_checklist_sidebar">
                      {selectedLoanPayments.length === 0 ? (
                        <p className="text-slate-450 text-center py-4">Nenhuma parcela associada a este empréstimo.</p>
                      ) : (
                        selectedLoanPayments.map(p => {
                          const isPaid = p.status === 'paid';
                          const paySplit = p.due_date.split('-');
                          const due = new Date(Number(paySplit[0]), Number(paySplit[1]) - 1, Number(paySplit[2]));
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const isOverdue = !isPaid && due < today;

                          return (
                            <div
                              key={p.id}
                              onClick={() => handleTogglePayment(p)}
                              className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                                isPaid 
                                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-250' 
                                  : isOverdue 
                                    ? 'bg-red-950/40 border-red-800 text-red-100 font-bold' 
                                    : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  isPaid 
                                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm' 
                                    : isOverdue 
                                      ? 'bg-red-900 border-red-750' 
                                      : 'border-slate-600 hover:border-slate-500'
                                }`}>
                                  {isPaid && <Check size={11} strokeWidth={3} />}
                                </div>
                                <div>
                                  <span className="font-mono text-[10px]">Parcela {p.installment_number}/{selectedLoan.installments_count}</span>
                                  <p className="text-[9px] text-slate-450 font-bold">Vence: {p.due_date.split('-').reverse().join('/')}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="font-bold block text-slate-100">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                {isPaid && (
                                  <span className="text-[8px] font-black text-emerald-400 block uppercase">Pago ✓</span>
                                )}
                                {isOverdue && (
                                  <span className="text-[8px] font-black text-red-400 block uppercase">Atrasado</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Actions anchor footer */}
                  <div className="border-t border-slate-800 pt-3 mt-auto flex flex-col gap-2">
                    <button
                      onClick={() => handleDeleteLoan(selectedLoan.id)}
                      className="w-full py-2 bg-red-950/70 hover:bg-red-900/80 text-red-100 border border-red-900 rounded font-black flex items-center justify-center gap-1.5 transition-all text-xs"
                    >
                      <Trash2 size={13} /> Deletar Empréstimo
                    </button>
                    <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                      *A exclusão removerá permanentemente o contrato e todo o histórico de amortização.
                    </p>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-100 border border-dashed border-slate-300 rounded-xl p-8 py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center h-full min-h-[300px]">
                  <Layers className="text-slate-300 mb-3.5" size={28} />
                  <p className="font-bold text-slate-700 mb-1">Painel Executive Desk</p>
                  <p className="text-slate-400 max-w-[200px] leading-relaxed">Selecione um contrato ao lado para dar baixa nas parcelas e visualizar contatos.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------- TAB: BANCO DE CLIENTES (BORROWERS) ----------------- */}
        {activeTab === 'borrowers' && (
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4" id="view_mode_borrowers">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-950 text-base">Devedores e Tomadores</h3>
                <p className="text-xs text-slate-500 mt-1">Gerenciamento completo das informações de clientes cadastrados.</p>
              </div>

              <button
                id="borrowers_trigger_add_borrower"
                onClick={() => { setShowAddBorrower(true); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} /> Cadastrar Novo Cliente
              </button>
            </div>

            {/* List conditional rendering */}
            {borrowers.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center">
                <Users size={45} className="text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-750 text-sm">Sem devedores adicionais</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                  Sem informações de modelo previamente carregadas. Comece cadastrando um cliente na Visão Geral.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-150 text-slate-450 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5">Nome do Cliente</th>
                      <th className="py-2.5">CPF / Documento</th>
                      <th className="py-2.5">WhatsApp / Celular</th>
                      <th className="py-2.5">E-mail</th>
                      <th className="py-2.5 text-center">Contratos Ativos</th>
                      <th className="py-2 text-right">Controles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrowers.map(b => {
                      const clientLoansList = loans.filter(l => l.borrower_id === b.id);
                      const isUnpaid = clientLoansList.some(l => l.status === 'overdue');

                      return (
                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50 font-semibold" id={`borrower_row_${b.id}`}>
                          <td className="py-3.5">
                            <span className="font-bold text-slate-900 block">{b.name}</span>
                          </td>
                          <td className="py-3.5 font-mono text-slate-650">{b.document || '---'}</td>
                          <td className="py-3.5 text-indigo-750 font-bold">
                            {b.phone ? (
                              <a 
                                href={`https://wa.me/${b.phone.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="hover:underline inline-flex items-center gap-1 bg-indigo-50/50 px-2 py-1 rounded"
                              >
                                {b.phone} <ExternalLink size={10} />
                              </a>
                            ) : (
                              '---'
                            )}
                          </td>
                          <td className="py-3.5 text-slate-600 font-normal">{b.email || '---'}</td>
                          <td className="py-3.5 text-center font-bold">
                            <span className="text-slate-950 font-black">{clientLoansList.length}</span>
                            {isUnpaid && (
                              <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-black uppercase">⚠️ Atrasado</span>
                            )}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteBorrower(b.id, b.name)}
                              className="p-1 px-2 border border-red-250 hover:border-red-300 text-red-650 font-bold rounded bg-red-50 hover:bg-red-100/80 transition-all inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* ----------------- TAB: CONFIGURAÇÃO DO SUPABASE ----------------- */}
        {activeTab === 'database' && (
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col gap-6" id="view_mode_database_installation">
            
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-slate-950 text-base flex items-center gap-2">
                <Database className="text-indigo-600" size={18} />
                Integração e Conectividade Supabase
              </h3>
              <p className="text-xs text-slate-500 mt-1">Conecte seu banco PostgreSQL do Supabase em tempo real utilizando as chaves seguras do seu console.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* INSTALATION INSTRUCTIONS */}
              <div className="lg:col-span-2 space-y-4 text-xs font-medium text-slate-600">
                <h4 className="font-extrabold text-slate-900 text-sm">Instruções Práticas de Configuração:</h4>
                <ol className="list-decimal list-inside space-y-2.5 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <li>No menu principal do AI Studio, abra o assistente de variáveis clicando no botão <strong className="text-indigo-800">Secrets</strong> no menu superior.</li>
                  <li>Adicione uma nova variável chamada <code className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">VITE_SUPABASE_URL</code> com o valor da URL do seu projeto Supabase.</li>
                  <li>Insira outra variável chamada <code className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">VITE_SUPABASE_ANON_KEY</code> preenchendo com sua chave pública Anon.</li>
                  <li>Pronto! O aplicativo identificará as chaves e fará a sincronização automática.</li>
                </ol>

                {/* MANUAL FALLBACK FORM DIRECT PASTE IN-APP */}
                <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-sm">
                  <h5 className="font-black text-slate-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={14} className="text-amber-500" />
                    Configuração Rápida Manual (Sem Redeploy)
                  </h5>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Você também pode colar as credenciais do seu Supabase diretamente aqui para testes rápidos. Elas ficarão guardadas somente no seu dispositivo.
                  </p>

                  <form onSubmit={handleSaveConnection} className="space-y-3 text-xs font-semibold">
                    <div>
                      <span className="text-[10px] text-slate-450 uppercase block mb-1">Project Endpoint URL:</span>
                      <input 
                        type="text" 
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://gajsdkgjasg.supabase.co"
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs tracking-wide focus:outline-none focus:bg-white focus:border-indigo-550"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-450 uppercase block mb-1">Anon Public Access Key:</span>
                      <input 
                        type="password" 
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-none focus:bg-white focus:border-indigo-550"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      {localStorage.getItem('supabase_url') && (
                        <button 
                          type="button"
                          onClick={handleClearConnection}
                          className="px-3 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded-md font-bold text-[11px] tracking-wide"
                        >
                          Limpar Ajustes / Desconectar
                        </button>
                      )}
                      
                      <button 
                        type="submit"
                        className="px-4 py-1.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded-md font-bold text-[11px] tracking-wide shadow-sm"
                      >
                        {isConnectionSaved ? "Salvo com sucesso! ✓" : "Salvar Configurações"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* INTEGRATION REPORT CARD */}
              <div className="bg-slate-50 border border-slate-250 p-5 rounded-xl text-xs flex flex-col justify-between" id="db_connection_status_summary">
                <div>
                  <h4 className="font-extrabold text-slate-900 mb-3 uppercase tracking-wider block">Relatório do Servidor:</h4>
                  
                  <div className="space-y-2.5 font-semibold text-slate-600">
                    <div className="flex justify-between">
                      <span>Provedor Ativo:</span>
                      <span className="font-black text-indigo-600 block uppercase">
                        {db.isConnected() ? 'Supabase PostgreSQL' : 'Local Storage Fallback'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Database Status:</span>
                      <span className={`font-black uppercase ${db.isConnected() ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {db.isConnected() ? 'Contectado à nuvem' : 'Executando em offline'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Tabelas de Amortização:</span>
                      <span className="text-slate-505 font-bold">Simples / Compostas</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-450">
                  ⚠️ No modo offline (Banco Local), seus dados ficam armazenados de forma isolada na memória de cache do seu navegador local.
                </div>
              </div>

            </div>

            {/* DDL SQL SCRIPT VIEWER */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                <div>
                  <h4 className="font-black text-slate-950 text-sm">Passo Final: Inicializar Tabelas no Supabase SQL Editor</h4>
                  <p className="text-xs text-slate-500 mt-1">Copie o script de geração abaixo, acesse a aba <strong>SQL Editor</strong> do painel Supabase e execute o comando.</p>
                </div>

                <button
                  onClick={copySQL}
                  className="px-4 py-2 mt-2 sm:mt-0 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition-all flex items-center gap-1.5"
                >
                  {isCopied ? (
                    <> <Check size={14} className="text-emerald-400" /> Copiado! </>
                  ) : (
                    <> <Copy size={14} /> Copiar Script SQL </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 relative">
                <pre className="text-[10px] font-mono text-slate-350 p-3 max-h-72 overflow-y-auto leading-relaxed scrollbar-thin">
                  {SQL_SCHEMA}
                </pre>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ----------------- GLOBAL MODALS (OVERLAYS) ----------------- */}
      {/* 1. ADD NEW BORROWER MODAL */}
      {showAddBorrower && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="modal_outer_borrower">
          <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full relative" id="modal_card_borrower">
            <button 
              onClick={() => setShowAddBorrower(false)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-5">
              <Users size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-slate-950 text-base">
                Cadastrar Novo Cliente / Devedor
              </h3>
            </div>

            <form onSubmit={handleCreateBorrower} className="space-y-4 text-xs font-semibold text-left">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase tracking-wider">Nome Completo / Empresa *</label>
                <input 
                  type="text" 
                  required
                  value={newBorrower.name}
                  onChange={(e) => setNewBorrower({...newBorrower, name: e.target.value})}
                  placeholder="Ex: Carlos Alberto de Souza"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase tracking-wider">CPF / CNPJ</label>
                  <input 
                    type="text" 
                    required
                    value={newBorrower.document}
                    onChange={(e) => setNewBorrower({...newBorrower, document: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase tracking-wider">WhatsApp / Telefone</label>
                  <input 
                    type="text" 
                    required
                    value={newBorrower.phone}
                    onChange={(e) => setNewBorrower({...newBorrower, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase tracking-wider">E-mail de Contrato</label>
                <input 
                  type="email" 
                  value={newBorrower.email}
                  onChange={(e) => setNewBorrower({...newBorrower, email: e.target.value})}
                  placeholder="exemplo@dominio.com"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3">
                <button 
                  type="button"
                  onClick={() => setShowAddBorrower(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-lg transition-all text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg transition-all text-xs shadow-md"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. REALTIME SIMULATOR & WORKSPACE FOR NEW LOAN CONCESSIONS MODAL */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="modal_outer_loan">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative p-6 sm:p-8" id="modal_card_loan">
            <button 
              onClick={() => setShowAddLoan(false)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-6">
              <Layers size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-slate-950 text-base">
                Conceder Empréstimo Financeiro
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              
              {/* Form Input Section */}
              <div>
                <form onSubmit={handleCreateLoan} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1 uppercase">Selecione o Cliente / Tomador *</label>
                    <select 
                      required
                      value={newLoan.borrower_id}
                      onChange={(e) => setNewLoan({...newLoan, borrower_id: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-xs font-semibold text-slate-800"
                    >
                      <option value="">Buscar devedor registrado...</option>
                      {borrowers.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.document || 'Sem documento'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Capital Principal (R$)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={newLoan.amount}
                        onChange={(e) => setNewLoan({...newLoan, amount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Número de Parcelas</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        max="60"
                        value={newLoan.installments_count}
                        onChange={(e) => setNewLoan({...newLoan, installments_count: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Taxa de Juros (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={newLoan.interest_rate}
                        onChange={(e) => setNewLoan({...newLoan, interest_rate: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Modelo de Juros</label>
                      <select 
                        value={newLoan.interest_type}
                        onChange={(e) => setNewLoan({...newLoan, interest_type: e.target.value as any})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      >
                        <option value="simple">Simples (Adicional fixo)</option>
                        <option value="compound">Composto (Mensal acumulado)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Frequência de Cobrança</label>
                      <select 
                        value={newLoan.payment_frequency}
                        onChange={(e) => setNewLoan({...newLoan, payment_frequency: e.target.value as any})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      >
                        <option value="monthly">Mensal</option>
                        <option value="weekly">Semanal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase">Data de Emissão</label>
                      <input 
                        type="date" 
                        required
                        value={newLoan.start_date}
                        onChange={(e) => setNewLoan({...newLoan, start_date: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowAddLoan(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-lg transition-all text-xs"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg tracking-wide shadow-md transition-all text-xs"
                    >
                      Confirmar Contrato
                    </button>
                  </div>
                </form>
              </div>

              {/* LIVE SIMULATOR SIDE CAR PANEL */}
              <div className="bg-slate-900 border border-slate-800 text-slate-100 p-5 rounded-xl flex flex-col justify-between" id="loan_simulator_panel">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-wider mb-2">
                    <Info size={14} />
                    Projeção de Amortização Financeira
                  </div>
                  <h4 className="text-base font-black text-white">Resultados da Simulação</h4>
                  
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-800 my-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-bold">Principal Inicial:</span>
                      <p className="text-base font-extrabold text-slate-100">
                        {newLoan.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Taxa Programada:</span>
                      <p className="text-base font-extrabold text-slate-100">
                        {newLoan.interest_rate}% ({newLoan.interest_type === 'simple' ? 'Simples' : 'Composto'})
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between font-normal">
                      <span className="text-slate-400">Total Acumulado a Receber:</span>
                      <span className="font-extrabold text-white">{previewSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between font-normal">
                      <span className="text-teal-400 font-bold">Repagamento de Juros (Lucro Puro):</span>
                      <span className="text-teal-400 font-extrabold">+{previewInterestGain.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white">
                      <span>{newLoan.installments_count}x Prestações de:</span>
                      <span className="text-amber-400 font-black text-sm">
                        {(previewPayments[0]?.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>

                  {/* Chronology breakdown list */}
                  <div className="mt-4 bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                    <p className="text-[10px] font-bold text-slate-400 border-b border-slate-900 pb-1 mb-1Sticky top-0 bg-slate-950">Vencimentos do cronograma simulado:</p>
                    {previewPayments.map((p) => (
                      <div key={p.installment_number} className="flex justify-between text-slate-350">
                        <span>Cobrança #{p.installment_number}</span>
                        <span>{p.due_date.split('-').reverse().join('/')}</span>
                        <span className="font-bold text-white">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                  *Cálculo matemático rigoroso. Eventuais frações são amortizadas no fechamento da última prestação cadastrada.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 text-center mt-auto text-[11px] text-slate-400">
        <p>© 2026 GestãoCred — Todos os cálculos de amortização de parcelas estão assegurados.</p>
      </footer>

    </div>
  );
}
