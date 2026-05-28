# Princípios de Código IA — Karpathy Guidelines

> Carregar este arquivo em qualquer tarefa de desenvolvimento.
> Fonte: https://github.com/multica-ai/andrej-karpathy-skills

## 1. Think Before Coding

Antes de implementar:
- Declarar suposições explicitamente. Se incerto, perguntar
- Se há múltiplas interpretações, apresentar — não escolher silenciosamente
- Se existe caminho mais simples, dizer. Pushback quando justificado
- Se algo não está claro, **parar**. Nomear o que confunde. Perguntar

## 2. Simplicity First

Código mínimo que resolve o problema. Nada especulativo.

- Nenhuma feature além do pedido
- Nenhuma abstração para código de uso único
- Nenhuma "flexibilidade" não pedida
- Se escreveu 200 linhas e poderia ser 50, reescrever

Teste: "Um engenheiro sênior diria que isso está complicado demais?" Se sim, simplificar.

## 3. Surgical Changes

Tocar só o necessário. Limpar só a própria bagunça.

- Não "melhorar" código adjacente não relacionado
- Combinar com estilo existente, mesmo discordando
- Remover imports/variáveis que SUA mudança deixou sem uso
- Dead code pré-existente: mencionar, não deletar

## 4. Goal-Driven Execution

Definir critério de sucesso. Loop até verificar.

Para tarefas multi-passo, declarar plano:
```
1. [Passo] → verificar: [check]
2. [Passo] → verificar: [check]
```
