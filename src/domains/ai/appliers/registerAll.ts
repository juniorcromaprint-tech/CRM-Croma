import { registerApplier } from './registry';
import { precoApplier, adicionarItemApplier, materialApplier, acabamentoApplier, quantidadeApplier, erroApplier } from './orcamento';
import { modeloApplier, servicoApplier } from './composicao';
import { tarefaApplier, contatoApplier, descontoApplier } from './cliente';
import { checklistApplier, pendenciaApplier, responsavelApplier } from './producao';
import { revalidarApplier, moverPedidoApplier, alertaApplier, notificarApplier } from './problemas';

// Orçamento
registerApplier('preco', precoApplier);
registerApplier('adicionar_item', adicionarItemApplier);
registerApplier('trocar_material', materialApplier);
registerApplier('adicionar_acabamento', acabamentoApplier);
registerApplier('ajustar_quantidade', quantidadeApplier);
registerApplier('corrigir_erro', erroApplier);

// Composição
registerApplier('definir_modelo', modeloApplier);
registerApplier('adicionar_material', materialApplier); // reuses material applier
registerApplier('adicionar_servico', servicoApplier);

// Cliente
registerApplier('criar_tarefa', tarefaApplier);
registerApplier('agendar_contato', contatoApplier);
registerApplier('aplicar_desconto', descontoApplier);

// Produção
registerApplier('criar_checklist', checklistApplier);
registerApplier('marcar_pendencia', pendenciaApplier);
registerApplier('atribuir_responsavel', responsavelApplier);

// Problemas
registerApplier('revalidar_orcamento', revalidarApplier);
registerApplier('mover_pedido', moverPedidoApplier);
registerApplier('criar_alerta', alertaApplier);
registerApplier('notificar_responsavel', notificarApplier);
