# Regra: AlertDialogAction com async — e.preventDefault() obrigatório

Toda mutation async dentro de `AlertDialogAction` do Radix UI DEVE usar `e.preventDefault()`.

## Por que
O Radix UI fecha o dialog automaticamente ao clicar em `AlertDialogAction`.
Isso mata a execução da função async antes de terminar — a mutation nunca executa.

## Como aplicar
```tsx
// ERRADO — dialog fecha antes da mutation executar
<AlertDialogAction onClick={() => handleApprove()}>
  Confirmar
</AlertDialogAction>

// CORRETO
<AlertDialogAction
  onClick={async (e) => {
    e.preventDefault() // impede o close automático
    await handleApprove()
    setOpen(false) // fecha manualmente após concluir
  }}
>
  Confirmar
</AlertDialogAction>
```

Aplica a: aprovação de propostas, conversão lead→cliente, cancelamento de pedidos,
confirmação de pagamento, e qualquer outro dialog com ação assíncrona.
