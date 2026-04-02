# Regra: Supabase Mutations — .select().single() obrigatório

Todo `.insert()` e `.update()` no Supabase DEVE encadear `.select().single()` ao final.

## Por que
O RLS (Row Level Security) bloqueia silenciosamente — retorna 0 rows sem lançar erro explícito.
Sem `.select().single()`, o código não detecta que a operação foi bloqueada e assume sucesso falso.

## Como aplicar
```ts
// ERRADO — não detecta bloqueio RLS
await supabase.from('leads').insert({ nome, telefone })

// CORRETO
const { data, error } = await supabase
  .from('leads')
  .insert({ nome, telefone })
  .select()
  .single()

if (error) throw error
```

Aplica a TODOS os módulos: leads, clientes, propostas, pedidos, contas_receber, ordens_producao, etc.
