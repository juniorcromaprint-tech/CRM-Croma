// Clientes
export {
  useClientes,
  useCliente,
  useCreateCliente,
  useUpdateCliente,
  useDeleteCliente,
  useClienteStats,
} from './useClientes';
export type {
  ClienteFilters,
  ClienteInput,
  ClienteUpdate,
  ClienteStats,
} from './useClientes';

// Unidades
export {
  useUnidades,
  useCreateUnidade,
  useUpdateUnidade,
} from './useUnidades';
export type {
  UnidadeInput,
  UnidadeUpdate,
} from './useUnidades';

// Contatos
export {
  useContatos,
  useCreateContato,
  useUpdateContato,
} from './useContatos';
export type {
  ContatoInput,
  ContatoUpdate,
} from './useContatos';
