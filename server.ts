import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API proxy route for Groq
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, contextData } = req.body;
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return res.status(400).json({ 
          error: "A chave de API do Groq (GROQ_API_KEY) não está configurada no servidor. Por favor, adicione-a no painel de Secrets (Configurações)."
        });
      }

      // Formatar o contexto atual de clientes e empréstimos
      let systemContent = `Você é um Assistente de Inteligência Artificial para o GestãoCred, um sistema moderno de controle de empréstimos, cobranças de parcelas e gestão de devedores.
Seu objetivo é ajudar o usuário do sistema (que é um gestor / credor de empréstimos) com quaisquer dúvidas sobre o uso do aplicativo, conceitos de amortização (juros simples e compostos) ou regras financeiras gerais.

Aqui está o contexto e os recursos do sistema:
1. Resumo Operacional (Dashboard): Mostra métricas financeiras essenciais tais como Capital Emprestado, Total Recebido, Saldo em Aberto, e Saldo Vencido (Inadimplência). Inclui também um indicador de inadimplência percentual e performance do retorno esperado frente ao lucro planejado por juros.
2. Contratos (Loans): Permite visualizar todos os empréstimos ativos, concluídos ou em atraso. Oferece a capacidade de abrir cada empréstimo para detalhar o cronograma de parcelas e compensar/dar baixa em prestações individualmente por meio de checkboxes.
3. Lista de Clientes (Borrowers): Cadastro de tomadores com Nome/Empresa, CPF/CNPJ, Telefone/WhatsApp e E-mail de Contrato.
4. Conexão/Configuração de Banco de Dados: Permite alternar dinamicamente e salvar credenciais do Supabase PostgreSQL para persistência durável na nuvem, ou desfrutar do "Modo Off-line / Banco Local" usando o LocalStorage do navegador. Oferece visualização clara do esquema DDL SQL das tabelas.
5. Emissão de Empréstimos: Suporta o cálculo preciso nos regimes de Juros Simples (adicional fixo sobre o principal) e Juros Compostos (mensal acumulado), com parcelas semanais ou mensais e simulação em tempo real antes da emissão do contrato.

Instruções adicionais de formato:
- Seja prestativo, objetivo, caloroso e responda de maneira clara e profissional em português do Brasil.
- Se for perguntado sobre como funciona o parcelamento ou as fórmulas, explique amigavelmente.
- Não invente recursos que o aplicativo não possui (ex: envio automático de e-mail integrado, faturamento automático por PIX, etc.), mas detalhe como o usuário pode operar com eficiência no estado atual.`;

      if (contextData) {
        const { borrowers = [], loans = [], summary = {} } = contextData;
        
        systemContent += `\n\n=== DADOS REAIS DO SISTEMA EM TEMPO REAL ===
O usuário possui atualmente os seguintes dados cadastrados no sistema (você deve usar essas informações para responder de forma precisa a perguntas sobre devedores específicos, empréstimos específicos ou balanço financeiro geral):

DADOS FINANCEIROS GERAIS:
- Capital Total Emprestado: R$ ${summary.totalAmountEmployed?.toLocaleString('pt-BR') || '0,00'}
- Total Já Recebido de Repagamentos: R$ ${summary.totalPaidReceived?.toLocaleString('pt-BR') || '0,00'}
- Saldo Restante em Aberto (A vencer): R$ ${summary.totalOutstandingFuture?.toLocaleString('pt-BR') || '0,00'}
- Saldo Vencido e em Atraso (Inadimplência): R$ ${summary.totalOverdueValue?.toLocaleString('pt-BR') || '0,00'}
- Taxa Geral de Inadimplência: ${summary.overdueRatePercent?.toFixed(1) || '0.0'}%

LISTA DE CLIENTES CADASTRADOS (${borrowers.length} devedores):
${borrowers.length === 0 ? '- Nenhum cliente cadastrado ainda no banco de dados.' : borrowers.map((b: any) => `- ID: ${b.id}\n  Nome: ${b.name}\n  Documento: ${b.document || 'Não informado'}\n  Telefone: ${b.phone || 'Não informado'}\n  E-mail: ${b.email || 'Não informado'}`).join('\n\n')}

LISTA DE EMPRÉSTIMOS CONCEDIDOS (${loans.length} contratos):
${loans.length === 0 ? '- Nenhum contrato de empréstimo ativo no momento.' : loans.map((l: any) => {
  const borrowerName = borrowers.find((b: any) => b.id === l.borrower_id)?.name || 'Cliente Desconhecido';
  return `- Tomador/Devedor: ${borrowerName}\n  Principal: R$ ${l.amount.toLocaleString('pt-BR')}\n  Parcelas: ${l.installments_count}x\n  Frequência: ${l.payment_frequency === 'weekly' ? 'Semanal' : 'Mensal'}\n  Taxa de Juros: ${l.interest_rate}% ao período (${l.interest_type === 'simple' ? 'Juros Simples' : 'Juros Compostos'})\n  Data de Início: ${l.start_date}\n  Status: ${l.status === 'completed' ? 'Quitado (Concluído)' : l.status === 'overdue' ? 'Em Atraso (Vencido)' : 'Ativo (Em dia)'}`;
}).join('\n\n')}
==========================================`;
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: systemContent
            },
            ...messages
          ],
          temperature: 0.7,
          max_completion_tokens: 1024
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API error:", errText);
        return res.status(response.status).json({ error: `Groq API Error: ${errText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error at /api/chat:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
