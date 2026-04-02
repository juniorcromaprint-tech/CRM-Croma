# T2 — Landing Page Comercial
> Copiar e colar no CLI

---

Criar uma landing page comercial para a Croma Print em APP-Landing/ (mesmo padrão do APP-Campo — app Vite standalone com React + Tailwind).

## Requisitos

1. Página única, moderna, mobile-first (clientes acessam pelo celular)

2. Seções:
   - **Hero**: "Comunicação Visual Profissional para Sua Rede de Lojas" + CTA WhatsApp + CTA "Pedir Orçamento"
   - **Serviços**: Cards com ícones — Fachadas ACM, Banners e Impressão Digital, Material PDV, Envelopamento Veicular, Letreiros e Letras Caixa, Sinalização
   - **Portfólio**: Grid de fotos (usar placeholders com gradientes azul/cinza por enquanto — Junior adiciona fotos reais depois)
   - **Clientes**: "Empresas que confiam na Croma" — logos em texto estilizado: Beira Rio, Renner, Paquetá
   - **Sobre**: Produção própria em São Paulo, atendimento nacional, equipe de 6 profissionais, orçamento rápido por IA
   - **Como Funciona**: 4 passos visuais: WhatsApp → Orçamento em Minutos → Aprovação Online → Produção e Instalação
   - **CTA final**: Botão WhatsApp grande + formulário simples (nome, empresa, email, telefone, "o que precisa")
   - **Footer**: Croma Print Comunicação Visual | CNPJ 18.923.994/0001-83 | junior@cromaprint.com.br | WhatsApp (11) 93947-1862

3. Formulário de contato:
   - Enviar dados para Supabase via API REST (criar lead automaticamente)
   - Endpoint: POST https://djwjmfgplnqyffdcgdaw.supabase.co/rest/v1/leads
   - Headers:
     - apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE
     - Content-Type: application/json
     - Prefer: return=representation
   - Body: { contato_nome, email, empresa, telefone, observacoes: "o que precisa", origem: "landing_page", status: "novo" }
   - Mostrar toast de sucesso: "Recebemos seu contato! Retornaremos em breve."
   - Mostrar toast de erro se falhar

4. Botão WhatsApp: link wa.me/5511939471862?text=Olá! Vim pelo site e gostaria de um orçamento.
   - Botão flutuante fixo no canto inferior direito (ícone WhatsApp verde)

5. Stack: React 19 + Vite + Tailwind CSS (copiar config do APP-Campo)
6. Cores: azul Croma (#1e40af primary, #2563eb secondary, #1d4ed8 hover), branco #ffffff, cinza claro #f8fafc, texto #1e293b
7. Fontes: Inter (Google Fonts)

8. SEO:
   - Title: "Croma Print - Comunicação Visual Profissional | Fachadas, Banners, PDV"
   - Meta description: "Fachadas em ACM, banners, material PDV, envelopamento veicular e letreiros para redes de lojas e franquias. Orçamento rápido por WhatsApp. Produção própria em SP."
   - Open Graph tags com imagem placeholder
   - favicon

9. Deploy: Criar vercel.json na pasta APP-Landing para deploy separado

10. Performance: código limpo, imagens otimizadas (SVG/CSS gradients), lazy loading

NÃO usar imagens externas de CDN. Usar SVG inline, gradientes CSS ou ícones Lucide para tudo.
O Junior vai adicionar fotos reais do portfólio depois.

Após criar, rodar `cd APP-Landing && npm install && npm run build` para verificar que compila.
