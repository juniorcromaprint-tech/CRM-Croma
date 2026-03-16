// Re-export registry API
export * from './entity-registry';

// Side-effect imports — register all 11 entities.
// Must be in a SEPARATE file from entity-registry.ts to avoid the
// "Cannot access 'registry' before initialization" TDZ error caused
// by ES module import hoisting in circular deps.
import './materiais.config';
import './produtos.config';
import './clientes.config';
import './fornecedores.config';
import './modelo-materiais.config';
import './modelo-processos.config';
import './contas-receber.config';
import './contas-pagar.config';
import './leads.config';
import './acabamentos.config';
import './servicos.config';
