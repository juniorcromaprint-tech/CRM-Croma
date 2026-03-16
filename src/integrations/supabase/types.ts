export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acabamentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          custo_unitario: number
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          custo_unitario?: number
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          custo_unitario?: number
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_config: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      agenda_instalacao: {
        Row: {
          created_at: string | null
          data: string
          disponivel: boolean | null
          equipe_id: string
          id: string
          observacoes: string | null
          ordem_instalacao_id: string | null
          turno: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          disponivel?: boolean | null
          equipe_id: string
          id?: string
          observacoes?: string | null
          ordem_instalacao_id?: string | null
          turno?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          disponivel?: boolean | null
          equipe_id?: string
          id?: string
          observacoes?: string | null
          ordem_instalacao_id?: string | null
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_instalacao_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_instalacao_ordem_instalacao_id_fkey"
            columns: ["ordem_instalacao_id"]
            isOneToOne: false
            referencedRelation: "ordens_instalacao"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos: {
        Row: {
          created_at: string | null
          entidade_id: string
          entidade_tipo: string
          id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_mime: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      assinaturas_campo: {
        Row: {
          assinante_cargo: string | null
          assinante_nome: string
          created_at: string | null
          field_task_id: string | null
          id: string
          imagem_url: string
        }
        Insert: {
          assinante_cargo?: string | null
          assinante_nome: string
          created_at?: string | null
          field_task_id?: string | null
          id?: string
          imagem_url: string
        }
        Update: {
          assinante_cargo?: string | null
          assinante_nome?: string
          created_at?: string | null
          field_task_id?: string | null
          id?: string
          imagem_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_signatures_field_task_id_fkey"
            columns: ["field_task_id"]
            isOneToOne: false
            referencedRelation: "tarefas_campo"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_comerciais: {
        Row: {
          autor_id: string | null
          created_at: string | null
          data_atividade: string | null
          descricao: string | null
          duracao_minutos: number | null
          entidade_id: string
          entidade_tipo: string
          id: string
          proximo_passo: string | null
          resultado: string | null
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string | null
          data_atividade?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          proximo_passo?: string | null
          resultado?: string | null
          tipo: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string | null
          data_atividade?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          proximo_passo?: string | null
          resultado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_comerciais_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_comerciais_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          agencia: string
          agencia_digito: string | null
          ativo: boolean | null
          banco_codigo: string
          banco_nome: string
          carteira: string
          cedente_cep: string | null
          cedente_cidade: string | null
          cedente_cnpj: string
          cedente_endereco: string | null
          cedente_estado: string | null
          cedente_nome: string
          conta: string
          conta_digito: string
          convenio: string | null
          created_at: string | null
          dias_protesto: number | null
          id: string
          instrucoes_padrao: string | null
          juros_ao_mes: number | null
          multa_percentual: number | null
          nome: string
          nosso_numero_sequencial: number
          updated_at: string | null
        }
        Insert: {
          agencia: string
          agencia_digito?: string | null
          ativo?: boolean | null
          banco_codigo: string
          banco_nome: string
          carteira?: string
          cedente_cep?: string | null
          cedente_cidade?: string | null
          cedente_cnpj: string
          cedente_endereco?: string | null
          cedente_estado?: string | null
          cedente_nome: string
          conta: string
          conta_digito: string
          convenio?: string | null
          created_at?: string | null
          dias_protesto?: number | null
          id?: string
          instrucoes_padrao?: string | null
          juros_ao_mes?: number | null
          multa_percentual?: number | null
          nome: string
          nosso_numero_sequencial?: number
          updated_at?: string | null
        }
        Update: {
          agencia?: string
          agencia_digito?: string | null
          ativo?: boolean | null
          banco_codigo?: string
          banco_nome?: string
          carteira?: string
          cedente_cep?: string | null
          cedente_cidade?: string | null
          cedente_cnpj?: string
          cedente_endereco?: string | null
          cedente_estado?: string | null
          cedente_nome?: string
          conta?: string
          conta_digito?: string
          convenio?: string | null
          created_at?: string | null
          dias_protesto?: number | null
          id?: string
          instrucoes_padrao?: string | null
          juros_ao_mes?: number | null
          multa_percentual?: number | null
          nome?: string
          nosso_numero_sequencial?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_remittance_items: {
        Row: {
          bank_slip_id: string
          conteudo_linha: string | null
          created_at: string | null
          id: string
          linha_numero: number
          remittance_id: string
        }
        Insert: {
          bank_slip_id: string
          conteudo_linha?: string | null
          created_at?: string | null
          id?: string
          linha_numero: number
          remittance_id: string
        }
        Update: {
          bank_slip_id?: string
          conteudo_linha?: string | null
          created_at?: string | null
          id?: string
          linha_numero?: number
          remittance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_remittance_items_bank_slip_id_fkey"
            columns: ["bank_slip_id"]
            isOneToOne: false
            referencedRelation: "bank_slips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_remittance_items_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "bank_remittances"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_remittances: {
        Row: {
          arquivo_nome: string
          bank_account_id: string
          conteudo_arquivo: string | null
          created_at: string | null
          enviado_em: string | null
          erro_descricao: string | null
          gerado_em: string | null
          gerado_por: string | null
          id: string
          numero_sequencial: number
          processado_em: string | null
          status: string
          total_registros: number
          updated_at: string | null
          valor_total: number
        }
        Insert: {
          arquivo_nome: string
          bank_account_id: string
          conteudo_arquivo?: string | null
          created_at?: string | null
          enviado_em?: string | null
          erro_descricao?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          numero_sequencial: number
          processado_em?: string | null
          status?: string
          total_registros?: number
          updated_at?: string | null
          valor_total?: number
        }
        Update: {
          arquivo_nome?: string
          bank_account_id?: string
          conteudo_arquivo?: string | null
          created_at?: string | null
          enviado_em?: string | null
          erro_descricao?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          numero_sequencial?: number
          processado_em?: string | null
          status?: string
          total_registros?: number
          updated_at?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_remittances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_return_items: {
        Row: {
          bank_slip_id: string | null
          conteudo_linha: string | null
          created_at: string | null
          data_credito: string | null
          data_pagamento: string | null
          id: string
          linha_numero: number | null
          nosso_numero: string
          ocorrencia_codigo: string
          ocorrencia_descricao: string | null
          processado: boolean | null
          return_id: string
          valor_juros: number | null
          valor_pago: number | null
          valor_tarifa: number | null
        }
        Insert: {
          bank_slip_id?: string | null
          conteudo_linha?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento?: string | null
          id?: string
          linha_numero?: number | null
          nosso_numero: string
          ocorrencia_codigo: string
          ocorrencia_descricao?: string | null
          processado?: boolean | null
          return_id: string
          valor_juros?: number | null
          valor_pago?: number | null
          valor_tarifa?: number | null
        }
        Update: {
          bank_slip_id?: string | null
          conteudo_linha?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento?: string | null
          id?: string
          linha_numero?: number | null
          nosso_numero?: string
          ocorrencia_codigo?: string
          ocorrencia_descricao?: string | null
          processado?: boolean | null
          return_id?: string
          valor_juros?: number | null
          valor_pago?: number | null
          valor_tarifa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_return_items_bank_slip_id_fkey"
            columns: ["bank_slip_id"]
            isOneToOne: false
            referencedRelation: "bank_slips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "bank_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_returns: {
        Row: {
          arquivo_nome: string
          bank_account_id: string
          created_at: string | null
          id: string
          importado_em: string | null
          importado_por: string | null
          processado_em: string | null
          status: string
          total_erros: number | null
          total_processados: number | null
          total_registros: number | null
        }
        Insert: {
          arquivo_nome: string
          bank_account_id: string
          created_at?: string | null
          id?: string
          importado_em?: string | null
          importado_por?: string | null
          processado_em?: string | null
          status?: string
          total_erros?: number | null
          total_processados?: number | null
          total_registros?: number | null
        }
        Update: {
          arquivo_nome?: string
          bank_account_id?: string
          created_at?: string | null
          id?: string
          importado_em?: string | null
          importado_por?: string | null
          processado_em?: string | null
          status?: string
          total_erros?: number | null
          total_processados?: number | null
          total_registros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_returns_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_slips: {
        Row: {
          bank_account_id: string
          cliente_id: string
          conta_receber_id: string | null
          created_at: string | null
          data_credito: string | null
          data_emissao: string
          data_limite_desconto: string | null
          data_pagamento: string | null
          data_vencimento: string
          id: string
          instrucoes: string | null
          motivo_rejeicao: string | null
          nosso_numero: string
          pedido_id: string | null
          sacado_cep: string | null
          sacado_cidade: string | null
          sacado_cpf_cnpj: string
          sacado_endereco: string | null
          sacado_estado: string | null
          sacado_nome: string
          seu_numero: string | null
          status: string
          updated_at: string | null
          valor_desconto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_nominal: number
          valor_pago: number | null
        }
        Insert: {
          bank_account_id: string
          cliente_id: string
          conta_receber_id?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_emissao?: string
          data_limite_desconto?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          instrucoes?: string | null
          motivo_rejeicao?: string | null
          nosso_numero: string
          pedido_id?: string | null
          sacado_cep?: string | null
          sacado_cidade?: string | null
          sacado_cpf_cnpj: string
          sacado_endereco?: string | null
          sacado_estado?: string | null
          sacado_nome: string
          seu_numero?: string | null
          status?: string
          updated_at?: string | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_nominal: number
          valor_pago?: number | null
        }
        Update: {
          bank_account_id?: string
          cliente_id?: string
          conta_receber_id?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_emissao?: string
          data_limite_desconto?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          instrucoes?: string | null
          motivo_rejeicao?: string | null
          nosso_numero?: string
          pedido_id?: string | null
          sacado_cep?: string | null
          sacado_cidade?: string | null
          sacado_cpf_cnpj?: string
          sacado_endereco?: string | null
          sacado_estado?: string | null
          sacado_nome?: string
          seu_numero?: string | null
          status?: string
          updated_at?: string | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_nominal?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_slips_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_slips_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_slips_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_slips_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          orcamento: number | null
          origem: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          orcamento?: number | null
          origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          orcamento?: number | null
          origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campo_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          target_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categorias_despesa: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string | null
          codigo: string
          created_at: string | null
          id: string
          nome: string
          parent_id: string | null
          plano_conta_id: string | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo: string
          created_at?: string | null
          id?: string
          nome: string
          parent_id?: string | null
          plano_conta_id?: string | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo?: string
          created_at?: string | null
          id?: string
          nome?: string
          parent_id?: string | null
          plano_conta_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_despesa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_despesa_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_despesa_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_produto: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem_exibicao: number | null
          slug: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem_exibicao?: number | null
          slug: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem_exibicao?: number | null
          slug?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          id: string
          nivel: number | null
          nome: string
          parent_id: string | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          id?: string
          nivel?: number | null
          nome: string
          parent_id?: string | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          id?: string
          nivel?: number | null
          nome?: string
          parent_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execucao_itens: {
        Row: {
          execucao_id: string
          foto_url: string | null
          id: string
          item_id: string
          observacao: string | null
          respondido_em: string | null
          status: string | null
        }
        Insert: {
          execucao_id: string
          foto_url?: string | null
          id?: string
          item_id: string
          observacao?: string | null
          respondido_em?: string | null
          status?: string | null
        }
        Update: {
          execucao_id?: string
          foto_url?: string | null
          id?: string
          item_id?: string
          observacao?: string | null
          respondido_em?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execucao_itens_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "checklist_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucao_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execucoes: {
        Row: {
          assinatura_url: string | null
          checklist_id: string
          concluido_em: string | null
          created_at: string | null
          executado_por: string | null
          id: string
          iniciado_em: string | null
          observacoes_gerais: string | null
          ordem_instalacao_id: string | null
          ordem_producao_id: string | null
          responsavel_pcp: string | null
          status: string | null
          tipo: string | null
        }
        Insert: {
          assinatura_url?: string | null
          checklist_id: string
          concluido_em?: string | null
          created_at?: string | null
          executado_por?: string | null
          id?: string
          iniciado_em?: string | null
          observacoes_gerais?: string | null
          ordem_instalacao_id?: string | null
          ordem_producao_id?: string | null
          responsavel_pcp?: string | null
          status?: string | null
          tipo?: string | null
        }
        Update: {
          assinatura_url?: string | null
          checklist_id?: string
          concluido_em?: string | null
          created_at?: string | null
          executado_por?: string | null
          id?: string
          iniciado_em?: string | null
          observacoes_gerais?: string | null
          ordem_instalacao_id?: string | null
          ordem_producao_id?: string | null
          responsavel_pcp?: string | null
          status?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execucoes_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "checklist_execucoes_ordem_instalacao_id_fkey"
            columns: ["ordem_instalacao_id"]
            isOneToOne: false
            referencedRelation: "ordens_instalacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_responsavel_pcp_fkey"
            columns: ["responsavel_pcp"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_responsavel_pcp_fkey"
            columns: ["responsavel_pcp"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      checklist_itens: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          checklist_id: string
          descricao: string
          id: string
          numero_item: number
          obrigatorio: boolean | null
          observacao: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          checklist_id: string
          descricao: string
          id?: string
          numero_item: number
          obrigatorio?: boolean | null
          observacao?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          checklist_id?: string
          descricao?: string
          id?: string
          numero_item?: number
          obrigatorio?: boolean | null
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
          versao: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          versao?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          versao?: number | null
        }
        Relationships: []
      }
      checklists_campo: {
        Row: {
          field_task_id: string
          id: string
          item: string
          marcado: boolean | null
          marcado_em: string | null
          observacao: string | null
          tipo: string
        }
        Insert: {
          field_task_id: string
          id?: string
          item: string
          marcado?: boolean | null
          marcado_em?: string | null
          observacao?: string | null
          tipo: string
        }
        Update: {
          field_task_id?: string
          id?: string
          item?: string
          marcado?: boolean | null
          marcado_em?: string | null
          observacao?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_checklists_field_task_id_fkey"
            columns: ["field_task_id"]
            isOneToOne: false
            referencedRelation: "tarefas_campo"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_almoxarife: {
        Row: {
          created_at: string | null
          devolvido_em: string | null
          ferramenta_id: string
          id: string
          observacoes: string | null
          pedido_id: string | null
          retirado_em: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          devolvido_em?: string | null
          ferramenta_id: string
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          retirado_em?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          devolvido_em?: string | null
          ferramenta_id?: string
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          retirado_em?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_almoxarife_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "ferramentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_almoxarife_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_almoxarife_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_almoxarife_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      cliente_contatos: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          cliente_id: string
          created_at: string | null
          departamento: string | null
          e_decisor: boolean | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          principal: boolean | null
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cliente_id: string
          created_at?: string | null
          departamento?: string | null
          e_decisor?: boolean | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          principal?: boolean | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cliente_id?: string
          created_at?: string | null
          departamento?: string | null
          e_decisor?: boolean | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          principal?: boolean | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_documentos: {
        Row: {
          cliente_id: string
          created_at: string | null
          id: string
          nome: string
          observacoes: string | null
          tipo: string
          uploaded_by: string | null
          url: string
          validade: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          tipo: string
          uploaded_by?: string | null
          url: string
          validade?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string
          uploaded_by?: string | null
          url?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      cliente_unidades: {
        Row: {
          ativo: boolean | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          contato_local: string | null
          created_at: string | null
          endereco: string | null
          estado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          contato_local?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          contato_local?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_unidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          classificacao: string | null
          cnpj: string | null
          complemento: string | null
          contato_financeiro: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          email_fiscal: string | null
          endereco: string | null
          estado: string | null
          id: string
          indicador_ie_destinatario: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          lead_id: string | null
          limite_credito: number | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          observacoes_fiscais: string | null
          origem: string | null
          pais: string | null
          razao_social: string
          regime_tributario: string | null
          segmento: string | null
          site: string | null
          sla_dias: number | null
          suframa: string | null
          telefone: string | null
          tipo_cliente: string | null
          tipo_contribuinte: string | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          classificacao?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_financeiro?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          email_fiscal?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicador_ie_destinatario?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          lead_id?: string | null
          limite_credito?: number | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_fiscais?: string | null
          origem?: string | null
          pais?: string | null
          razao_social: string
          regime_tributario?: string | null
          segmento?: string | null
          site?: string | null
          sla_dias?: number | null
          suframa?: string | null
          telefone?: string | null
          tipo_cliente?: string | null
          tipo_contribuinte?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          classificacao?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_financeiro?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          email_fiscal?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          indicador_ie_destinatario?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          lead_id?: string | null
          limite_credito?: number | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_fiscais?: string | null
          origem?: string | null
          pais?: string | null
          razao_social?: string
          regime_tributario?: string | null
          segmento?: string | null
          site?: string | null
          sla_dias?: number | null
          suframa?: string | null
          telefone?: string | null
          tipo_cliente?: string | null
          tipo_contribuinte?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      comissoes: {
        Row: {
          conta_receber_id: string | null
          created_at: string | null
          data_pagamento: string | null
          excluido_em: string | null
          excluido_por: string | null
          id: string
          pedido_id: string
          percentual: number
          status: string | null
          valor_base: number
          valor_comissao: number
          vendedor_id: string
        }
        Insert: {
          conta_receber_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          pedido_id: string
          percentual: number
          status?: string | null
          valor_base: number
          valor_comissao: number
          vendedor_id: string
        }
        Update: {
          conta_receber_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          pedido_id?: string
          percentual?: number
          status?: string | null
          valor_base?: number
          valor_comissao?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "comissoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string | null
          watermark_enabled: boolean | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          watermark_enabled?: boolean | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          watermark_enabled?: boolean | null
        }
        Relationships: []
      }
      config_precificacao: {
        Row: {
          ativo: boolean | null
          atualizado_por: string | null
          created_at: string | null
          custo_operacional: number | null
          custo_produtivo: number | null
          faturamento_medio: number | null
          horas_mes: number | null
          id: string
          percentual_comissao: number | null
          percentual_impostos: number | null
          percentual_juros: number | null
          qtd_funcionarios: number | null
          updated_at: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_por?: string | null
          created_at?: string | null
          custo_operacional?: number | null
          custo_produtivo?: number | null
          faturamento_medio?: number | null
          horas_mes?: number | null
          id?: string
          percentual_comissao?: number | null
          percentual_impostos?: number | null
          percentual_juros?: number | null
          qtd_funcionarios?: number | null
          updated_at?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_por?: string | null
          created_at?: string | null
          custo_operacional?: number | null
          custo_produtivo?: number | null
          faturamento_medio?: number | null
          horas_mes?: number | null
          id?: string
          percentual_comissao?: number | null
          percentual_impostos?: number | null
          percentual_juros?: number | null
          qtd_funcionarios?: number | null
          updated_at?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_precificacao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_precificacao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          categoria: string | null
          centro_custo_id: string | null
          conta_plano_id: string | null
          created_at: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          excluido_em: string | null
          excluido_por: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          numero_nf: string | null
          numero_titulo: string | null
          observacoes: string | null
          pedido_compra_id: string | null
          saldo: number | null
          status: string | null
          updated_at: string | null
          valor_original: number
          valor_pago: number | null
        }
        Insert: {
          categoria?: string | null
          centro_custo_id?: string | null
          conta_plano_id?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nf?: string | null
          numero_titulo?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          saldo?: number | null
          status?: string | null
          updated_at?: string | null
          valor_original: number
          valor_pago?: number | null
        }
        Update: {
          categoria?: string | null
          centro_custo_id?: string | null
          conta_plano_id?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_nf?: string | null
          numero_titulo?: string | null
          observacoes?: string | null
          pedido_compra_id?: string | null
          saldo?: number | null
          status?: string | null
          updated_at?: string | null
          valor_original?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_conta_plano_id_fkey"
            columns: ["conta_plano_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          centro_custo_id: string | null
          cliente_id: string
          conta_plano_id: string | null
          created_at: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          excluido_em: string | null
          excluido_por: string | null
          forma_pagamento: string | null
          id: string
          numero_titulo: string | null
          observacoes: string | null
          pedido_id: string | null
          saldo: number | null
          status: string | null
          updated_at: string | null
          valor_original: number
          valor_pago: number | null
        }
        Insert: {
          centro_custo_id?: string | null
          cliente_id: string
          conta_plano_id?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_titulo?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          saldo?: number | null
          status?: string | null
          updated_at?: string | null
          valor_original: number
          valor_pago?: number | null
        }
        Update: {
          centro_custo_id?: string | null
          cliente_id?: string
          conta_plano_id?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_titulo?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          saldo?: number | null
          status?: string | null
          updated_at?: string | null
          valor_original?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_conta_plano_id_fkey"
            columns: ["conta_plano_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "contas_receber_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_compra: {
        Row: {
          condicao_pagamento: string | null
          created_at: string | null
          fornecedor_id: string
          id: string
          material_id: string
          observacoes: string | null
          prazo_entrega_dias: number | null
          quantidade: number
          selecionada: boolean | null
          solicitacao_id: string | null
          validade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          condicao_pagamento?: string | null
          created_at?: string | null
          fornecedor_id: string
          id?: string
          material_id: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          quantidade: number
          selecionada?: boolean | null
          solicitacao_id?: string | null
          validade?: string | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          condicao_pagamento?: string | null
          created_at?: string | null
          fornecedor_id?: string
          id?: string
          material_id?: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          quantidade?: number
          selecionada?: boolean | null
          solicitacao_id?: string | null
          validade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_compra_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_bordo: {
        Row: {
          created_at: string | null
          custo: number | null
          descricao: string
          ferramenta_id: string
          id: string
          proximo_em: string | null
          realizado_em: string | null
          realizado_por: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          custo?: number | null
          descricao: string
          ferramenta_id: string
          id?: string
          proximo_em?: string | null
          realizado_em?: string | null
          realizado_por?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          custo?: number | null
          descricao?: string
          ferramenta_id?: string
          id?: string
          proximo_em?: string | null
          realizado_em?: string | null
          realizado_por?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_bordo_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "ferramentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_bordo_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_bordo_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      equipe_membros: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          equipe_id: string
          funcao: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          equipe_id: string
          funcao?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          equipe_id?: string
          funcao?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          regiao: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          regiao?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          regiao?: string | null
        }
        Relationships: []
      }
      estoque_inventario: {
        Row: {
          ajustado: boolean | null
          created_at: string | null
          data_contagem: string | null
          diferenca: number
          id: string
          material_id: string
          movimentacao_id: string | null
          observacoes: string | null
          quantidade_contada: number
          quantidade_sistema: number
          responsavel_id: string | null
        }
        Insert: {
          ajustado?: boolean | null
          created_at?: string | null
          data_contagem?: string | null
          diferenca: number
          id?: string
          material_id: string
          movimentacao_id?: string | null
          observacoes?: string | null
          quantidade_contada: number
          quantidade_sistema: number
          responsavel_id?: string | null
        }
        Update: {
          ajustado?: boolean | null
          created_at?: string | null
          data_contagem?: string | null
          diferenca?: number
          id?: string
          material_id?: string
          movimentacao_id?: string | null
          observacoes?: string | null
          quantidade_contada?: number
          quantidade_sistema?: number
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_inventario_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_inventario_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_inventario_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          motivo: string | null
          quantidade: number
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          motivo?: string | null
          quantidade: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          motivo?: string | null
          quantidade?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      estoque_saldos: {
        Row: {
          id: string
          material_id: string
          quantidade_disponivel: number | null
          quantidade_reservada: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          material_id: string
          quantidade_disponivel?: number | null
          quantidade_reservada?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          material_id?: string
          quantidade_disponivel?: number | null
          quantidade_reservada?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_saldos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramentas: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fiscal_ambientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cnpj_emitente: string | null
          codigo: string
          codigo_municipio_ibge: string | null
          complemento: string | null
          created_at: string
          crt: number | null
          endpoint_base: string | null
          id: string
          ie_emitente: string | null
          im_emitente: string | null
          logradouro: string | null
          municipio: string | null
          nome: string
          numero_endereco: string | null
          razao_social_emitente: string | null
          telefone_emitente: string | null
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj_emitente?: string | null
          codigo: string
          codigo_municipio_ibge?: string | null
          complemento?: string | null
          created_at?: string
          crt?: number | null
          endpoint_base?: string | null
          id?: string
          ie_emitente?: string | null
          im_emitente?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome: string
          numero_endereco?: string | null
          razao_social_emitente?: string | null
          telefone_emitente?: string | null
          tipo: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj_emitente?: string | null
          codigo?: string
          codigo_municipio_ibge?: string | null
          complemento?: string | null
          created_at?: string
          crt?: number | null
          endpoint_base?: string | null
          id?: string
          ie_emitente?: string | null
          im_emitente?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome?: string
          numero_endereco?: string | null
          razao_social_emitente?: string | null
          telefone_emitente?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_audit_logs: {
        Row: {
          acao: string
          antes: Json | null
          created_at: string
          depois: Json | null
          entidade: string
          entidade_id: string
          id: string
          metadados: Json | null
          resultado: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          entidade: string
          entidade_id: string
          id?: string
          metadados?: Json | null
          resultado?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          entidade?: string
          entidade_id?: string
          id?: string
          metadados?: Json | null
          resultado?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      fiscal_certificados: {
        Row: {
          ambiente_id: string | null
          arquivo_encriptado_url: string
          ativo: boolean
          cnpj_titular: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacoes: string | null
          senha_secret_ref: string | null
          thumbprint: string | null
          tipo_certificado: string
          ultimo_teste_em: string | null
          ultimo_teste_status: string | null
          updated_at: string
          validade_fim: string | null
          validade_inicio: string | null
        }
        Insert: {
          ambiente_id?: string | null
          arquivo_encriptado_url: string
          ativo?: boolean
          cnpj_titular: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          senha_secret_ref?: string | null
          thumbprint?: string | null
          tipo_certificado: string
          ultimo_teste_em?: string | null
          ultimo_teste_status?: string | null
          updated_at?: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Update: {
          ambiente_id?: string | null
          arquivo_encriptado_url?: string
          ativo?: boolean
          cnpj_titular?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          senha_secret_ref?: string | null
          thumbprint?: string | null
          tipo_certificado?: string
          ultimo_teste_em?: string | null
          ultimo_teste_status?: string | null
          updated_at?: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_certificados_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "fiscal_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_certificados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      fiscal_documentos: {
        Row: {
          ambiente_id: string | null
          categoria_operacao: string | null
          certificado_id: string | null
          chave_acesso: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_autorizacao: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          finalidade_emissao: string | null
          id: string
          informacoes_contribuinte: string | null
          informacoes_fisco: string | null
          mensagem_erro: string | null
          natureza_operacao: string | null
          numero: number | null
          observacoes: string | null
          payload_json: Json | null
          pdf_url: string | null
          pedido_id: string
          protocolo: string | null
          provider: string
          recibo: string | null
          regra_operacao_id: string | null
          retorno_json: Json | null
          serie_id: string | null
          status: string
          tipo_documento: string
          updated_at: string
          updated_by: string | null
          valor_bc_icms: number
          valor_bc_icms_st: number
          valor_cofins: number
          valor_danfe: number
          valor_desconto: number
          valor_frete: number
          valor_icms: number
          valor_icms_st: number
          valor_ii: number
          valor_ipi: number
          valor_outras_despesas: number
          valor_pis: number
          valor_produtos: number
          valor_seguro: number
          valor_total: number
          xml_url: string | null
        }
        Insert: {
          ambiente_id?: string | null
          categoria_operacao?: string | null
          certificado_id?: string | null
          chave_acesso?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          finalidade_emissao?: string | null
          id?: string
          informacoes_contribuinte?: string | null
          informacoes_fisco?: string | null
          mensagem_erro?: string | null
          natureza_operacao?: string | null
          numero?: number | null
          observacoes?: string | null
          payload_json?: Json | null
          pdf_url?: string | null
          pedido_id: string
          protocolo?: string | null
          provider: string
          recibo?: string | null
          regra_operacao_id?: string | null
          retorno_json?: Json | null
          serie_id?: string | null
          status?: string
          tipo_documento: string
          updated_at?: string
          updated_by?: string | null
          valor_bc_icms?: number
          valor_bc_icms_st?: number
          valor_cofins?: number
          valor_danfe?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_icms_st?: number
          valor_ii?: number
          valor_ipi?: number
          valor_outras_despesas?: number
          valor_pis?: number
          valor_produtos?: number
          valor_seguro?: number
          valor_total?: number
          xml_url?: string | null
        }
        Update: {
          ambiente_id?: string | null
          categoria_operacao?: string | null
          certificado_id?: string | null
          chave_acesso?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          finalidade_emissao?: string | null
          id?: string
          informacoes_contribuinte?: string | null
          informacoes_fisco?: string | null
          mensagem_erro?: string | null
          natureza_operacao?: string | null
          numero?: number | null
          observacoes?: string | null
          payload_json?: Json | null
          pdf_url?: string | null
          pedido_id?: string
          protocolo?: string | null
          provider?: string
          recibo?: string | null
          regra_operacao_id?: string | null
          retorno_json?: Json | null
          serie_id?: string | null
          status?: string
          tipo_documento?: string
          updated_at?: string
          updated_by?: string | null
          valor_bc_icms?: number
          valor_bc_icms_st?: number
          valor_cofins?: number
          valor_danfe?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_icms_st?: number
          valor_ii?: number
          valor_ipi?: number
          valor_outras_despesas?: number
          valor_pis?: number
          valor_produtos?: number
          valor_seguro?: number
          valor_total?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documentos_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "fiscal_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "fiscal_certificados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "fiscal_documentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_regra_operacao_id_fkey"
            columns: ["regra_operacao_id"]
            isOneToOne: false
            referencedRelation: "fiscal_regras_operacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "fiscal_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      fiscal_documentos_itens: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          base_calculo_cofins: number | null
          base_calculo_icms: number | null
          base_calculo_ipi: number | null
          base_calculo_pis: number | null
          cest: string | null
          cfop: string
          codigo_produto: string | null
          created_at: string
          cst_ou_csosn: string | null
          descricao: string
          fiscal_documento_id: string
          id: string
          item_numero: number
          ncm: string | null
          observacoes: string | null
          origem_mercadoria: string | null
          pedido_item_id: string | null
          quantidade: number
          unidade: string
          valor_bruto: number
          valor_cofins: number | null
          valor_desconto: number
          valor_icms: number | null
          valor_ipi: number | null
          valor_pis: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          base_calculo_cofins?: number | null
          base_calculo_icms?: number | null
          base_calculo_ipi?: number | null
          base_calculo_pis?: number | null
          cest?: string | null
          cfop: string
          codigo_produto?: string | null
          created_at?: string
          cst_ou_csosn?: string | null
          descricao: string
          fiscal_documento_id: string
          id?: string
          item_numero: number
          ncm?: string | null
          observacoes?: string | null
          origem_mercadoria?: string | null
          pedido_item_id?: string | null
          quantidade?: number
          unidade?: string
          valor_bruto?: number
          valor_cofins?: number | null
          valor_desconto?: number
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          base_calculo_cofins?: number | null
          base_calculo_icms?: number | null
          base_calculo_ipi?: number | null
          base_calculo_pis?: number | null
          cest?: string | null
          cfop?: string
          codigo_produto?: string | null
          created_at?: string
          cst_ou_csosn?: string | null
          descricao?: string
          fiscal_documento_id?: string
          id?: string
          item_numero?: number
          ncm?: string | null
          observacoes?: string | null
          origem_mercadoria?: string | null
          pedido_item_id?: string | null
          quantidade?: number
          unidade?: string
          valor_bruto?: number
          valor_cofins?: number | null
          valor_desconto?: number
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documentos_itens_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_itens_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_erros_transmissao: {
        Row: {
          codigo_erro: string | null
          created_at: string
          etapa: string | null
          fiscal_documento_id: string | null
          id: string
          mensagem_erro: string
          payload_resumido: Json | null
          provider: string
          stack_resumida: string | null
        }
        Insert: {
          codigo_erro?: string | null
          created_at?: string
          etapa?: string | null
          fiscal_documento_id?: string | null
          id?: string
          mensagem_erro: string
          payload_resumido?: Json | null
          provider: string
          stack_resumida?: string | null
        }
        Update: {
          codigo_erro?: string | null
          created_at?: string
          etapa?: string | null
          fiscal_documento_id?: string | null
          id?: string
          mensagem_erro?: string
          payload_resumido?: Json | null
          provider?: string
          stack_resumida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_erros_transmissao_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_eventos: {
        Row: {
          created_at: string
          created_by: string | null
          fiscal_documento_id: string
          id: string
          justificativa: string | null
          mensagem: string | null
          payload_envio: Json | null
          payload_retorno: Json | null
          protocolo: string | null
          status: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fiscal_documento_id: string
          id?: string
          justificativa?: string | null
          mensagem?: string | null
          payload_envio?: Json | null
          payload_retorno?: Json | null
          protocolo?: string | null
          status: string
          tipo_evento: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fiscal_documento_id?: string
          id?: string
          justificativa?: string | null
          mensagem?: string | null
          payload_envio?: Json | null
          payload_retorno?: Json | null
          protocolo?: string | null
          status?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_eventos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_eventos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "fiscal_eventos_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_filas_emissao: {
        Row: {
          created_at: string
          fiscal_documento_id: string
          id: string
          locked_at: string | null
          locked_by: string | null
          prioridade: number
          proxima_tentativa_em: string | null
          status_fila: string
          tentativas: number
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_documento_id: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          prioridade?: number
          proxima_tentativa_em?: string | null
          status_fila?: string
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_documento_id?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          prioridade?: number
          proxima_tentativa_em?: string | null
          status_fila?: string
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_filas_emissao_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_regras_operacao: {
        Row: {
          ambiente_id: string | null
          ativo: boolean
          cfop: string | null
          codigo: string | null
          consumidor_final: boolean | null
          contribuinte_icms: boolean | null
          created_at: string
          csosn_padrao: string | null
          cst_padrao: string | null
          finalidade_nfe: string | null
          gerar_financeiro_apos_autorizacao: boolean
          id: string
          natureza_operacao: string
          ncm_padrao: string | null
          nome: string
          observacoes: string | null
          prioridade_regra: number
          serie_id: string | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          ambiente_id?: string | null
          ativo?: boolean
          cfop?: string | null
          codigo?: string | null
          consumidor_final?: boolean | null
          contribuinte_icms?: boolean | null
          created_at?: string
          csosn_padrao?: string | null
          cst_padrao?: string | null
          finalidade_nfe?: string | null
          gerar_financeiro_apos_autorizacao?: boolean
          id?: string
          natureza_operacao: string
          ncm_padrao?: string | null
          nome: string
          observacoes?: string | null
          prioridade_regra?: number
          serie_id?: string | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          ambiente_id?: string | null
          ativo?: boolean
          cfop?: string | null
          codigo?: string | null
          consumidor_final?: boolean | null
          contribuinte_icms?: boolean | null
          created_at?: string
          csosn_padrao?: string | null
          cst_padrao?: string | null
          finalidade_nfe?: string | null
          gerar_financeiro_apos_autorizacao?: boolean
          id?: string
          natureza_operacao?: string
          ncm_padrao?: string | null
          nome?: string
          observacoes?: string | null
          prioridade_regra?: number
          serie_id?: string | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_regras_operacao_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "fiscal_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_regras_operacao_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "fiscal_series"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_series: {
        Row: {
          ambiente_id: string
          ativo: boolean
          created_at: string
          id: string
          observacoes: string | null
          serie: number
          tipo_documento: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ambiente_id: string
          ativo?: boolean
          created_at?: string
          id?: string
          observacoes?: string | null
          serie: number
          tipo_documento: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ambiente_id?: string
          ativo?: boolean
          created_at?: string
          id?: string
          observacoes?: string | null
          serie?: number
          tipo_documento?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_series_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "fiscal_ambientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_xmls: {
        Row: {
          created_at: string
          fiscal_documento_id: string
          hash_arquivo: string | null
          id: string
          storage_path: string
          tamanho_bytes: number | null
          tipo_arquivo: string
        }
        Insert: {
          created_at?: string
          fiscal_documento_id: string
          hash_arquivo?: string | null
          id?: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo_arquivo: string
        }
        Update: {
          created_at?: string
          fiscal_documento_id?: string
          hash_arquivo?: string | null
          id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_xmls_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          categorias: string[] | null
          cnpj: string | null
          condicao_pagamento: string | null
          contato_nome: string | null
          created_at: string | null
          email: string | null
          id: string
          lead_time_dias: number | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categorias?: string[] | null
          cnpj?: string | null
          condicao_pagamento?: string | null
          contato_nome?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_time_dias?: number | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categorias?: string[] | null
          cnpj?: string | null
          condicao_pagamento?: string | null
          contato_nome?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_time_dias?: number | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      historico_precos_fornecedor: {
        Row: {
          created_at: string | null
          data_cotacao: string | null
          fornecedor_id: string | null
          id: string
          material_id: string | null
          observacao: string | null
          preco: number
        }
        Insert: {
          created_at?: string | null
          data_cotacao?: string | null
          fornecedor_id?: string | null
          id?: string
          material_id?: string | null
          observacao?: string | null
          preco: number
        }
        Update: {
          created_at?: string | null
          data_cotacao?: string | null
          fornecedor_id?: string | null
          id?: string
          material_id?: string | null
          observacao?: string | null
          preco?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_precos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          job_id: string | null
          note: string | null
          photo_type: string
          photo_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          note?: string | null
          photo_type: string
          photo_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          note?: string | null
          photo_type?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_videos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          job_id: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_videos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_videos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["job_id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          deleted_at: string | null
          finished_at: string | null
          id: string
          issues: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          ordem_instalacao_id: string | null
          os_number: string
          pedido_id: string | null
          pedido_item_id: string | null
          scheduled_date: string | null
          signature_url: string | null
          started_at: string | null
          status: string | null
          store_id: string | null
          type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          issues?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          ordem_instalacao_id?: string | null
          os_number: string
          pedido_id?: string | null
          pedido_item_id?: string | null
          scheduled_date?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          store_id?: string | null
          type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          issues?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          ordem_instalacao_id?: string | null
          os_number?: string
          pedido_id?: string | null
          pedido_item_id?: string | null
          scheduled_date?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          store_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["store_id"]
          },
        ]
      }
      lancamentos_caixa: {
        Row: {
          categoria: string
          centro_custo_id: string | null
          comprovante_url: string | null
          conta_pagar_id: string | null
          conta_plano_id: string | null
          conta_receber_id: string | null
          created_at: string | null
          data_lancamento: string
          descricao: string
          id: string
          observacoes: string | null
          registrado_por: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          centro_custo_id?: string | null
          comprovante_url?: string | null
          conta_pagar_id?: string | null
          conta_plano_id?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao: string
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string
          centro_custo_id?: string | null
          comprovante_url?: string | null
          conta_pagar_id?: string | null
          conta_plano_id?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_caixa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_conta_plano_id_fkey"
            columns: ["conta_plano_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      import_logs: {
        Row: {
          id: string
          user_id: string
          entity: string
          operation: string
          filename: string | null
          total_rows: number
          inserted: number
          updated: number
          skipped: number
          errors: number
          error_details: Json
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entity: string
          operation: string
          filename?: string | null
          total_rows?: number
          inserted?: number
          updated?: number
          skipped?: number
          errors?: number
          error_details?: Json
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entity?: string
          operation?: string
          filename?: string | null
          total_rows?: number
          inserted?: number
          updated?: number
          skipped?: number
          errors?: number
          error_details?: Json
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          campanha_id: string | null
          cargo: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string | null
          email: string | null
          empresa: string
          id: string
          motivo_descarte: string | null
          observacoes: string | null
          origem_id: string | null
          proximo_contato: string | null
          score: number | null
          segmento: string | null
          status: string | null
          telefone: string | null
          temperatura: string | null
          updated_at: string | null
          valor_estimado: number | null
          vendedor_id: string | null
        }
        Insert: {
          campanha_id?: string | null
          cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          email?: string | null
          empresa: string
          id?: string
          motivo_descarte?: string | null
          observacoes?: string | null
          origem_id?: string | null
          proximo_contato?: string | null
          score?: number | null
          segmento?: string | null
          status?: string | null
          telefone?: string | null
          temperatura?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Update: {
          campanha_id?: string | null
          cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          email?: string | null
          empresa?: string
          id?: string
          motivo_descarte?: string | null
          observacoes?: string | null
          origem_id?: string | null
          proximo_contato?: string | null
          score?: number | null
          segmento?: string | null
          status?: string | null
          telefone?: string | null
          temperatura?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      materiais: {
        Row: {
          aproveitamento: number | null
          ativo: boolean | null
          categoria: string | null
          codigo: string | null
          created_at: string | null
          data_referencia_preco: string | null
          estoque_minimo: number | null
          id: string
          localizacao: string | null
          ncm: string | null
          nome: string
          plano_contas_entrada: string | null
          plano_contas_saida: string | null
          preco_medio: number | null
          unidade: string | null
          updated_at: string | null
          venda_direta: boolean | null
        }
        Insert: {
          aproveitamento?: number | null
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          data_referencia_preco?: string | null
          estoque_minimo?: number | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          nome: string
          plano_contas_entrada?: string | null
          plano_contas_saida?: string | null
          preco_medio?: number | null
          unidade?: string | null
          updated_at?: string | null
          venda_direta?: boolean | null
        }
        Update: {
          aproveitamento?: number | null
          ativo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          data_referencia_preco?: string | null
          estoque_minimo?: number | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          nome?: string
          plano_contas_entrada?: string | null
          plano_contas_saida?: string | null
          preco_medio?: number | null
          unidade?: string | null
          updated_at?: string | null
          venda_direta?: boolean | null
        }
        Relationships: []
      }
      metas_vendas: {
        Row: {
          created_at: string | null
          id: string
          meta_quantidade: number | null
          meta_valor: number | null
          periodo_fim: string
          periodo_inicio: string
          realizado_quantidade: number | null
          realizado_valor: number | null
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta_quantidade?: number | null
          meta_valor?: number | null
          periodo_fim: string
          periodo_inicio: string
          realizado_quantidade?: number | null
          realizado_valor?: number | null
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meta_quantidade?: number | null
          meta_valor?: number | null
          periodo_fim?: string
          periodo_inicio?: string
          realizado_quantidade?: number | null
          realizado_valor?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      midias_campo: {
        Row: {
          created_at: string | null
          descricao: string | null
          field_task_id: string
          id: string
          momento: string
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          field_task_id: string
          id?: string
          momento: string
          tipo: string
          url: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          field_task_id?: string
          id?: string
          momento?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_media_field_task_id_fkey"
            columns: ["field_task_id"]
            isOneToOne: false
            referencedRelation: "tarefas_campo"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_materiais: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          modelo_id: string
          quantidade_por_unidade: number | null
          tipo: string
          unidade: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          modelo_id: string
          quantidade_por_unidade?: number | null
          tipo?: string
          unidade?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          modelo_id?: string
          quantidade_por_unidade?: number | null
          tipo?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modelo_materiais_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_materiais_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "produto_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_materiais_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "vw_modelos_completos"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_processos: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          etapa: string
          id: string
          modelo_id: string
          ordem: number | null
          tempo_por_unidade_min: number | null
          tipo_processo: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string | null
          etapa: string
          id?: string
          modelo_id: string
          ordem?: number | null
          tempo_por_unidade_min?: number | null
          tipo_processo?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string | null
          etapa?: string
          id?: string
          modelo_id?: string
          ordem?: number | null
          tempo_por_unidade_min?: number | null
          tipo_processo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modelo_processos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_processos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "produto_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_processos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "vw_modelos_completos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_internas: {
        Row: {
          autor_id: string | null
          conteudo: string
          created_at: string | null
          entidade_id: string
          entidade_tipo: string
          id: string
        }
        Insert: {
          autor_id?: string | null
          conteudo: string
          created_at?: string | null
          entidade_id: string
          entidade_tipo: string
          id?: string
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          created_at?: string | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_internas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_internas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida: boolean | null
          lida_em: string | null
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida: boolean | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ocorrencia_tratativas: {
        Row: {
          acao_corretiva: string | null
          created_at: string | null
          data_conclusao: string | null
          id: string
          observacoes: string | null
          ocorrencia_id: string
          prazo: string | null
          responsavel_id: string | null
        }
        Insert: {
          acao_corretiva?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          observacoes?: string | null
          ocorrencia_id: string
          prazo?: string | null
          responsavel_id?: string | null
        }
        Update: {
          acao_corretiva?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          id?: string
          observacoes?: string | null
          ocorrencia_id?: string
          prazo?: string | null
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_tratativas_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_tratativas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_tratativas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          causa: string | null
          created_at: string | null
          custo_mo: number | null
          custo_mp: number | null
          custo_total: number | null
          descricao: string
          excluido_em: string | null
          excluido_por: string | null
          id: string
          impacto_prazo_dias: number | null
          numero: string | null
          ordem_instalacao_id: string | null
          ordem_producao_id: string | null
          pedido_id: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          causa?: string | null
          created_at?: string | null
          custo_mo?: number | null
          custo_mp?: number | null
          custo_total?: number | null
          descricao: string
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          impacto_prazo_dias?: number | null
          numero?: string | null
          ordem_instalacao_id?: string | null
          ordem_producao_id?: string | null
          pedido_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          causa?: string | null
          created_at?: string | null
          custo_mo?: number | null
          custo_mp?: number | null
          custo_total?: number | null
          descricao?: string
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          impacto_prazo_dias?: number | null
          numero?: string | null
          ordem_instalacao_id?: string | null
          ordem_producao_id?: string | null
          pedido_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "ocorrencias_ordem_instalacao_id_fkey"
            columns: ["ordem_instalacao_id"]
            isOneToOne: false
            referencedRelation: "ordens_instalacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_fechamento_prevista: string | null
          data_fechamento_real: string | null
          descricao: string | null
          fase: string | null
          id: string
          lead_id: string | null
          motivo_perda: string | null
          probabilidade: number | null
          titulo: string
          updated_at: string | null
          valor_estimado: number | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_fechamento_prevista?: string | null
          data_fechamento_real?: string | null
          descricao?: string | null
          fase?: string | null
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          probabilidade?: number | null
          titulo: string
          updated_at?: string | null
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_fechamento_prevista?: string | null
          data_fechamento_real?: string | null
          descricao?: string | null
          fase?: string | null
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          probabilidade?: number | null
          titulo?: string
          updated_at?: string | null
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      ordens_instalacao: {
        Row: {
          cliente_id: string
          created_at: string | null
          custo_logistico: number | null
          data_agendada: string | null
          data_execucao: string | null
          endereco_completo: string | null
          equipe_id: string | null
          excluido_em: string | null
          excluido_por: string | null
          hora_prevista: string | null
          id: string
          instrucoes: string | null
          materiais_necessarios: string | null
          motivo_reagendamento: string | null
          numero: string | null
          observacoes: string | null
          pedido_id: string
          pedido_item_id: string | null
          status: string | null
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          custo_logistico?: number | null
          data_agendada?: string | null
          data_execucao?: string | null
          endereco_completo?: string | null
          equipe_id?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          hora_prevista?: string | null
          id?: string
          instrucoes?: string | null
          materiais_necessarios?: string | null
          motivo_reagendamento?: string | null
          numero?: string | null
          observacoes?: string | null
          pedido_id: string
          pedido_item_id?: string | null
          status?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          custo_logistico?: number | null
          data_agendada?: string | null
          data_execucao?: string | null
          endereco_completo?: string | null
          equipe_id?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          hora_prevista?: string | null
          id?: string
          instrucoes?: string | null
          materiais_necessarios?: string | null
          motivo_reagendamento?: string | null
          numero?: string | null
          observacoes?: string | null
          pedido_id?: string
          pedido_item_id?: string | null
          status?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_instalacao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_instalacao_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_instalacao_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_instalacao_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "ordens_instalacao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_instalacao_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_instalacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "cliente_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao: {
        Row: {
          created_at: string | null
          custo_mo_estimado: number | null
          custo_mo_real: number | null
          custo_mp_estimado: number | null
          custo_mp_real: number | null
          data_conclusao: string | null
          data_inicio: string | null
          excluido_em: string | null
          excluido_por: string | null
          id: string
          numero: string | null
          observacoes: string | null
          pedido_id: string | null
          pedido_item_id: string | null
          prazo_interno: string | null
          prioridade: number | null
          responsavel_id: string | null
          status: string
          tempo_estimado_min: number | null
          tempo_real_min: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo_mo_estimado?: number | null
          custo_mo_real?: number | null
          custo_mp_estimado?: number | null
          custo_mp_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          pedido_item_id?: string | null
          prazo_interno?: string | null
          prioridade?: number | null
          responsavel_id?: string | null
          status?: string
          tempo_estimado_min?: number | null
          tempo_real_min?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo_mo_estimado?: number | null
          custo_mo_real?: number | null
          custo_mp_estimado?: number | null
          custo_mp_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          pedido_item_id?: string | null
          prazo_interno?: string | null
          prioridade?: number | null
          responsavel_id?: string | null
          status?: string
          tempo_estimado_min?: number | null
          tempo_real_min?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "ordens_producao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      origens_lead: {
        Row: {
          ativo: boolean | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      parcelas_pagar: {
        Row: {
          conta_pagar_id: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          status: string | null
          valor: number
        }
        Insert: {
          conta_pagar_id: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: string | null
          valor: number
        }
        Update: {
          conta_pagar_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagar_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_receber: {
        Row: {
          conta_receber_id: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          status: string | null
          valor: number
        }
        Insert: {
          conta_receber_id: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: string | null
          valor: number
        }
        Update: {
          conta_receber_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_receber_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_compra_itens: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          pedido_compra_id: string
          quantidade: number
          quantidade_recebida: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          pedido_compra_id: string
          quantidade: number
          quantidade_recebida?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          pedido_compra_id?: string
          quantidade?: number
          quantidade_recebida?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_compra_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_compra_itens_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_historico: {
        Row: {
          created_at: string | null
          dados_json: Json | null
          descricao: string | null
          id: string
          pedido_id: string
          tipo_evento: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dados_json?: Json | null
          descricao?: string | null
          id?: string
          pedido_id: string
          tipo_evento: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dados_json?: Json | null
          descricao?: string | null
          id?: string
          pedido_id?: string
          tipo_evento?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_historico_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_historico_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          altura_cm: number | null
          area_m2: number | null
          arte_url: string | null
          created_at: string | null
          custo_fixo: number | null
          custo_mo: number | null
          custo_mp: number | null
          descricao: string
          especificacao: string | null
          excluido_em: string | null
          excluido_por: string | null
          id: string
          instrucoes: string | null
          largura_cm: number | null
          markup_percentual: number | null
          modelo_id: string | null
          pedido_id: string
          prazo_producao_dias: number | null
          produto_id: string | null
          proposta_item_id: string | null
          quantidade: number
          status: string | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          altura_cm?: number | null
          area_m2?: number | null
          arte_url?: string | null
          created_at?: string | null
          custo_fixo?: number | null
          custo_mo?: number | null
          custo_mp?: number | null
          descricao: string
          especificacao?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          instrucoes?: string | null
          largura_cm?: number | null
          markup_percentual?: number | null
          modelo_id?: string | null
          pedido_id: string
          prazo_producao_dias?: number | null
          produto_id?: string | null
          proposta_item_id?: string | null
          quantidade?: number
          status?: string | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          altura_cm?: number | null
          area_m2?: number | null
          arte_url?: string | null
          created_at?: string | null
          custo_fixo?: number | null
          custo_mo?: number | null
          custo_mp?: number | null
          descricao?: string
          especificacao?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          instrucoes?: string | null
          largura_cm?: number | null
          markup_percentual?: number | null
          modelo_id?: string | null
          pedido_id?: string
          prazo_producao_dias?: number | null
          produto_id?: string | null
          proposta_item_id?: string | null
          quantidade?: number
          status?: string | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedido_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "produto_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "vw_modelos_completos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_proposta_item_id_fkey"
            columns: ["proposta_item_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          bloqueio_fiscal_motivo: string | null
          cancelado_em: string | null
          cliente_id: string
          created_at: string | null
          custo_total: number | null
          data_conclusao: string | null
          data_prometida: string | null
          excluido_em: string | null
          excluido_por: string | null
          fiscal_regra_id: string | null
          fiscal_validado: boolean | null
          fiscal_validado_em: string | null
          fiscal_validado_por: string | null
          id: string
          margem_real: number | null
          motivo_cancelamento: string | null
          numero: string | null
          observacoes: string | null
          onedrive_folder_id: string | null
          onedrive_folder_url: string | null
          possui_documento_fiscal: boolean | null
          prioridade: string | null
          proposta_id: string | null
          status: string
          status_fiscal: string | null
          tipo_documento_previsto: string | null
          ultimo_documento_fiscal_id: string | null
          updated_at: string | null
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          bloqueio_fiscal_motivo?: string | null
          cancelado_em?: string | null
          cliente_id: string
          created_at?: string | null
          custo_total?: number | null
          data_conclusao?: string | null
          data_prometida?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fiscal_regra_id?: string | null
          fiscal_validado?: boolean | null
          fiscal_validado_em?: string | null
          fiscal_validado_por?: string | null
          id?: string
          margem_real?: number | null
          motivo_cancelamento?: string | null
          numero?: string | null
          observacoes?: string | null
          onedrive_folder_id?: string | null
          onedrive_folder_url?: string | null
          possui_documento_fiscal?: boolean | null
          prioridade?: string | null
          proposta_id?: string | null
          status?: string
          status_fiscal?: string | null
          tipo_documento_previsto?: string | null
          ultimo_documento_fiscal_id?: string | null
          updated_at?: string | null
          valor_total?: number
          vendedor_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          bloqueio_fiscal_motivo?: string | null
          cancelado_em?: string | null
          cliente_id?: string
          created_at?: string | null
          custo_total?: number | null
          data_conclusao?: string | null
          data_prometida?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fiscal_regra_id?: string | null
          fiscal_validado?: boolean | null
          fiscal_validado_em?: string | null
          fiscal_validado_por?: string | null
          id?: string
          margem_real?: number | null
          motivo_cancelamento?: string | null
          numero?: string | null
          observacoes?: string | null
          onedrive_folder_id?: string | null
          onedrive_folder_url?: string | null
          possui_documento_fiscal?: boolean | null
          prioridade?: string | null
          proposta_id?: string | null
          status?: string
          status_fiscal?: string | null
          tipo_documento_previsto?: string | null
          ultimo_documento_fiscal_id?: string | null
          updated_at?: string | null
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pedidos_fiscal_regra"
            columns: ["fiscal_regra_id"]
            isOneToOne: false
            referencedRelation: "fiscal_regras_operacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pedidos_ultimo_documento_fiscal"
            columns: ["ultimo_documento_fiscal_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_fiscal_validado_por_fkey"
            columns: ["fiscal_validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_fiscal_validado_por_fkey"
            columns: ["fiscal_validado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          excluido_em: string | null
          excluido_por: string | null
          fornecedor_id: string
          id: string
          numero: string | null
          observacoes: string | null
          previsao_entrega: string | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fornecedor_id: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          previsao_entrega?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fornecedor_id?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          previsao_entrega?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_compra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_compra_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          acao: string
          descricao: string | null
          id: string
          modulo: string
        }
        Insert: {
          acao: string
          descricao?: string | null
          id?: string
          modulo: string
        }
        Update: {
          acao?: string
          descricao?: string | null
          id?: string
          modulo?: string
        }
        Relationships: []
      }
      permissoes_perfil: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean | null
          categoria_slug: string | null
          codigo: string
          created_at: string | null
          grupo: string | null
          id: string
          natureza: string | null
          nome: string
          parent_id: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          categoria_slug?: string | null
          codigo: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          natureza?: string | null
          nome: string
          parent_id?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          categoria_slug?: string | null
          codigo?: string
          created_at?: string | null
          grupo?: string | null
          id?: string
          natureza?: string | null
          nome?: string
          parent_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_producao: {
        Row: {
          ativo: boolean | null
          automatico: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean | null
          automatico?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean | null
          automatico?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      producao_apontamentos: {
        Row: {
          created_at: string | null
          fim: string | null
          id: string
          inicio: string
          observacoes: string | null
          operador_id: string
          ordem_producao_id: string
          producao_etapa_id: string
          tempo_minutos: number | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio: string
          observacoes?: string | null
          operador_id: string
          ordem_producao_id: string
          producao_etapa_id: string
          tempo_minutos?: number | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          observacoes?: string | null
          operador_id?: string
          ordem_producao_id?: string
          producao_etapa_id?: string
          tempo_minutos?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_apontamentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "producao_apontamentos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_apontamentos_producao_etapa_id_fkey"
            columns: ["producao_etapa_id"]
            isOneToOne: false
            referencedRelation: "producao_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_checklist: {
        Row: {
          conferido: boolean | null
          conferido_em: string | null
          conferido_por: string | null
          id: string
          item: string
          observacao: string | null
          ordem_producao_id: string
        }
        Insert: {
          conferido?: boolean | null
          conferido_em?: string | null
          conferido_por?: string | null
          id?: string
          item: string
          observacao?: string | null
          ordem_producao_id: string
        }
        Update: {
          conferido?: boolean | null
          conferido_em?: string | null
          conferido_por?: string | null
          id?: string
          item?: string
          observacao?: string | null
          ordem_producao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_checklist_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_checklist_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "producao_checklist_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_etapas: {
        Row: {
          created_at: string | null
          fim: string | null
          id: string
          inicio: string | null
          nome: string
          observacoes: string | null
          ordem: number | null
          ordem_producao_id: string
          responsavel_id: string | null
          status: string | null
          tempo_estimado_min: number | null
          tempo_real_min: number | null
        }
        Insert: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          nome: string
          observacoes?: string | null
          ordem?: number | null
          ordem_producao_id: string
          responsavel_id?: string | null
          status?: string | null
          tempo_estimado_min?: number | null
          tempo_real_min?: number | null
        }
        Update: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          nome?: string
          observacoes?: string | null
          ordem?: number | null
          ordem_producao_id?: string
          responsavel_id?: string | null
          status?: string | null
          tempo_estimado_min?: number | null
          tempo_real_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_etapas_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_etapas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_etapas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      producao_materiais: {
        Row: {
          created_at: string | null
          custo_total: number | null
          custo_unitario: number | null
          id: string
          material_id: string
          movimentacao_id: string | null
          ordem_producao_id: string
          quantidade_consumida: number | null
          quantidade_prevista: number | null
        }
        Insert: {
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          id?: string
          material_id: string
          movimentacao_id?: string | null
          ordem_producao_id: string
          quantidade_consumida?: number | null
          quantidade_prevista?: number | null
        }
        Update: {
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          id?: string
          material_id?: string
          movimentacao_id?: string | null
          ordem_producao_id?: string
          quantidade_consumida?: number | null
          quantidade_prevista?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_materiais_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_materiais_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_retrabalho: {
        Row: {
          causa: string
          created_at: string | null
          custo_adicional_mo: number | null
          custo_adicional_mp: number | null
          data_registro: string | null
          data_resolucao: string | null
          descricao: string | null
          id: string
          ordem_producao_id: string
          responsavel_id: string | null
        }
        Insert: {
          causa: string
          created_at?: string | null
          custo_adicional_mo?: number | null
          custo_adicional_mp?: number | null
          data_registro?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          ordem_producao_id: string
          responsavel_id?: string | null
        }
        Update: {
          causa?: string
          created_at?: string | null
          custo_adicional_mo?: number | null
          custo_adicional_mp?: number | null
          data_registro?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          ordem_producao_id?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_retrabalho_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_retrabalho_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_retrabalho_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      produto_modelos: {
        Row: {
          altura_cm: number | null
          area_m2: number | null
          ativo: boolean | null
          created_at: string | null
          descricao_fiscal: string | null
          descritivo_nf: string | null
          descritivo_tecnico: string | null
          garantia_descricao: string | null
          garantia_meses: number | null
          id: string
          largura_cm: number | null
          linha_qualidade: string | null
          margem_minima: number | null
          markup_padrao: number | null
          ncm: string | null
          nome: string
          preco_fixo: number | null
          produto_id: string
          tempo_producao_min: number | null
          unidade_venda: string | null
          updated_at: string | null
        }
        Insert: {
          altura_cm?: number | null
          area_m2?: number | null
          ativo?: boolean | null
          created_at?: string | null
          descricao_fiscal?: string | null
          descritivo_nf?: string | null
          descritivo_tecnico?: string | null
          garantia_descricao?: string | null
          garantia_meses?: number | null
          id?: string
          largura_cm?: number | null
          linha_qualidade?: string | null
          margem_minima?: number | null
          markup_padrao?: number | null
          ncm?: string | null
          nome: string
          preco_fixo?: number | null
          produto_id: string
          tempo_producao_min?: number | null
          unidade_venda?: string | null
          updated_at?: string | null
        }
        Update: {
          altura_cm?: number | null
          area_m2?: number | null
          ativo?: boolean | null
          created_at?: string | null
          descricao_fiscal?: string | null
          descritivo_nf?: string | null
          descritivo_tecnico?: string | null
          garantia_descricao?: string | null
          garantia_meses?: number | null
          id?: string
          largura_cm?: number | null
          linha_qualidade?: string | null
          margem_minima?: number | null
          markup_padrao?: number | null
          ncm?: string | null
          nome?: string
          preco_fixo?: number | null
          produto_id?: string
          tempo_producao_min?: number | null
          unidade_venda?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_modelos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria: string
          categoria_id: string | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          id: string
          margem_minima: number | null
          markup_padrao: number | null
          nome: string
          requer_instalacao: boolean | null
          tipo_checklist_instalacao: string | null
          unidade_padrao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          margem_minima?: number | null
          markup_padrao?: number | null
          nome: string
          requer_instalacao?: boolean | null
          tipo_checklist_instalacao?: string | null
          unidade_padrao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          margem_minima?: number | null
          markup_padrao?: number | null
          nome?: string
          requer_instalacao?: boolean | null
          tipo_checklist_instalacao?: string | null
          unidade_padrao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          created_at: string | null
          departamento: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          role: string | null
          role_id: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          departamento?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          role?: string | null
          role_id?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          departamento?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
          role_id?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_attachments: {
        Row: {
          created_at: string | null
          id: string
          nome_arquivo: string
          onedrive_download_url: string | null
          onedrive_file_id: string | null
          onedrive_file_url: string | null
          proposta_id: string
          storage_path: string | null
          storage_url: string | null
          tamanho_bytes: number | null
          tipo_mime: string | null
          uploaded_by_name: string | null
          uploaded_by_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_arquivo: string
          onedrive_download_url?: string | null
          onedrive_file_id?: string | null
          onedrive_file_url?: string | null
          proposta_id: string
          storage_path?: string | null
          storage_url?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by_name?: string | null
          uploaded_by_type?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_arquivo?: string
          onedrive_download_url?: string | null
          onedrive_file_id?: string | null
          onedrive_file_url?: string | null
          proposta_id?: string
          storage_path?: string | null
          storage_url?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by_name?: string | null
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_attachments_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_item_acabamentos: {
        Row: {
          acabamento_id: string | null
          created_at: string | null
          custo_total: number
          custo_unitario: number
          descricao: string
          id: string
          proposta_item_id: string
          quantidade: number
        }
        Insert: {
          acabamento_id?: string | null
          created_at?: string | null
          custo_total?: number
          custo_unitario?: number
          descricao: string
          id?: string
          proposta_item_id: string
          quantidade?: number
        }
        Update: {
          acabamento_id?: string | null
          created_at?: string | null
          custo_total?: number
          custo_unitario?: number
          descricao?: string
          id?: string
          proposta_item_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_item_acabamentos_acabamento_id_fkey"
            columns: ["acabamento_id"]
            isOneToOne: false
            referencedRelation: "acabamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_item_acabamentos_proposta_item_id_fkey"
            columns: ["proposta_item_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_item_materiais: {
        Row: {
          created_at: string | null
          custo_total: number
          custo_unitario: number
          descricao: string
          id: string
          material_id: string | null
          proposta_item_id: string
          quantidade: number
          unidade: string
        }
        Insert: {
          created_at?: string | null
          custo_total?: number
          custo_unitario?: number
          descricao: string
          id?: string
          material_id?: string | null
          proposta_item_id: string
          quantidade: number
          unidade: string
        }
        Update: {
          created_at?: string | null
          custo_total?: number
          custo_unitario?: number
          descricao?: string
          id?: string
          material_id?: string | null
          proposta_item_id?: string
          quantidade?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_item_materiais_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_item_materiais_proposta_item_id_fkey"
            columns: ["proposta_item_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_item_processos: {
        Row: {
          created_at: string | null
          etapa: string
          id: string
          ordem: number | null
          proposta_item_id: string
          tempo_minutos: number
        }
        Insert: {
          created_at?: string | null
          etapa: string
          id?: string
          ordem?: number | null
          proposta_item_id: string
          tempo_minutos?: number
        }
        Update: {
          created_at?: string | null
          etapa?: string
          id?: string
          ordem?: number | null
          proposta_item_id?: string
          tempo_minutos?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_item_processos_proposta_item_id_fkey"
            columns: ["proposta_item_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_itens: {
        Row: {
          altura_cm: number | null
          area_m2: number | null
          created_at: string | null
          custo_fixo: number | null
          custo_mo: number | null
          custo_mp: number | null
          descricao: string
          especificacao: string | null
          id: string
          largura_cm: number | null
          markup_percentual: number | null
          modelo_id: string | null
          ordem: number | null
          prazo_producao_dias: number | null
          produto_id: string | null
          proposta_id: string
          quantidade: number
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          altura_cm?: number | null
          area_m2?: number | null
          created_at?: string | null
          custo_fixo?: number | null
          custo_mo?: number | null
          custo_mp?: number | null
          descricao: string
          especificacao?: string | null
          id?: string
          largura_cm?: number | null
          markup_percentual?: number | null
          modelo_id?: string | null
          ordem?: number | null
          prazo_producao_dias?: number | null
          produto_id?: string | null
          proposta_id: string
          quantidade?: number
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          altura_cm?: number | null
          area_m2?: number | null
          created_at?: string | null
          custo_fixo?: number | null
          custo_mo?: number | null
          custo_mp?: number | null
          descricao?: string
          especificacao?: string | null
          id?: string
          largura_cm?: number | null
          markup_percentual?: number | null
          modelo_id?: string | null
          ordem?: number | null
          prazo_producao_dias?: number | null
          produto_id?: string | null
          proposta_id?: string
          quantidade?: number
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "produto_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "vw_modelos_completos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_servicos: {
        Row: {
          created_at: string | null
          descricao: string
          horas: number | null
          id: string
          proposta_id: string
          servico_id: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string | null
          descricao: string
          horas?: number | null
          id?: string
          proposta_id: string
          servico_id?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string | null
          descricao?: string
          horas?: number | null
          id?: string
          proposta_id?: string
          servico_id?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_servicos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versoes: {
        Row: {
          created_at: string | null
          criado_por: string | null
          id: string
          motivo_revisao: string | null
          proposta_id: string
          snapshot_itens: Json
          snapshot_totais: Json
          versao: number
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          motivo_revisao?: string | null
          proposta_id: string
          snapshot_itens: Json
          snapshot_totais: Json
          versao: number
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          id?: string
          motivo_revisao?: string | null
          proposta_id?: string
          snapshot_itens?: Json
          snapshot_totais?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_views: {
        Row: {
          browser: string | null
          clicked_items: Json | null
          created_at: string | null
          device_type: string | null
          downloaded_pdf: boolean | null
          duration_seconds: number | null
          geo_city: string | null
          geo_country: string | null
          geo_region: string | null
          id: string
          ip_address: unknown
          max_scroll_depth: number | null
          os: string | null
          page_closed_at: string | null
          page_opened_at: string
          proposta_id: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          clicked_items?: Json | null
          created_at?: string | null
          device_type?: string | null
          downloaded_pdf?: boolean | null
          duration_seconds?: number | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: unknown
          max_scroll_depth?: number | null
          os?: string | null
          page_closed_at?: string | null
          page_opened_at?: string
          proposta_id: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          clicked_items?: Json | null
          created_at?: string | null
          device_type?: string | null
          downloaded_pdf?: boolean | null
          duration_seconds?: number | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: unknown
          max_scroll_depth?: number | null
          os?: string | null
          page_closed_at?: string | null
          page_opened_at?: string
          proposta_id?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_views_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          aprovado_em: string | null
          aprovado_pelo_cliente: boolean | null
          aprovado_pelo_cliente_at: string | null
          aprovado_por: string | null
          cliente_cnpj_snapshot: string | null
          cliente_id: string
          cliente_nome_snapshot: string | null
          comentario_cliente: string | null
          condicoes_pagamento: string | null
          config_snapshot: Json | null
          created_at: string | null
          desconto_percentual: number | null
          desconto_valor: number | null
          descricao: string | null
          entrada_percentual: number | null
          excluido_em: string | null
          excluido_por: string | null
          forma_pagamento: string | null
          id: string
          ip_aprovacao: unknown
          numero: string | null
          observacoes: string | null
          onedrive_folder_id: string | null
          onedrive_folder_url: string | null
          oportunidade_id: string | null
          parcelas_count: number | null
          prazo_dias: number[] | null
          probabilidade: number | null
          share_token: string | null
          share_token_active: boolean | null
          share_token_expires_at: string | null
          status: string
          subtotal: number | null
          titulo: string | null
          total: number
          updated_at: string | null
          validade_dias: number | null
          valor_estimado: number | null
          vendedor_id: string | null
          versao: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_pelo_cliente?: boolean | null
          aprovado_pelo_cliente_at?: string | null
          aprovado_por?: string | null
          cliente_cnpj_snapshot?: string | null
          cliente_id: string
          cliente_nome_snapshot?: string | null
          comentario_cliente?: string | null
          condicoes_pagamento?: string | null
          config_snapshot?: Json | null
          created_at?: string | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          descricao?: string | null
          entrada_percentual?: number | null
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          id?: string
          ip_aprovacao?: unknown
          numero?: string | null
          observacoes?: string | null
          onedrive_folder_id?: string | null
          onedrive_folder_url?: string | null
          oportunidade_id?: string | null
          parcelas_count?: number | null
          prazo_dias?: number[] | null
          probabilidade?: number | null
          share_token?: string | null
          share_token_active?: boolean | null
          share_token_expires_at?: string | null
          status?: string
          subtotal?: number | null
          titulo?: string | null
          total?: number
          updated_at?: string | null
          validade_dias?: number | null
          valor_estimado?: number | null
          vendedor_id?: string | null
          versao?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_pelo_cliente?: boolean | null
          aprovado_pelo_cliente_at?: string | null
          aprovado_por?: string | null
          cliente_cnpj_snapshot?: string | null
          cliente_id?: string
          cliente_nome_snapshot?: string | null
          comentario_cliente?: string | null
          condicoes_pagamento?: string | null
          config_snapshot?: Json | null
          created_at?: string | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          descricao?: string | null
          entrada_percentual?: number | null
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          id?: string
          ip_aprovacao?: unknown
          numero?: string | null
          observacoes?: string | null
          onedrive_folder_id?: string | null
          onedrive_folder_url?: string | null
          oportunidade_id?: string | null
          parcelas_count?: number | null
          prazo_dias?: number[] | null
          probabilidade?: number | null
          share_token?: string | null
          share_token_active?: boolean | null
          share_token_expires_at?: string | null
          status?: string
          subtotal?: number | null
          titulo?: string | null
          total?: number
          updated_at?: string | null
          validade_dias?: number | null
          valor_estimado?: number | null
          vendedor_id?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "propostas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      recebimento_itens: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          motivo_recusa: string | null
          pedido_compra_item_id: string
          quantidade_aceita: number | null
          quantidade_esperada: number
          quantidade_recebida: number
          recebimento_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          motivo_recusa?: string | null
          pedido_compra_item_id: string
          quantidade_aceita?: number | null
          quantidade_esperada: number
          quantidade_recebida: number
          recebimento_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          motivo_recusa?: string | null
          pedido_compra_item_id?: string
          quantidade_aceita?: number | null
          quantidade_esperada?: number
          quantidade_recebida?: number
          recebimento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recebimento_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_pedido_compra_item_id_fkey"
            columns: ["pedido_compra_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_compra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          conferido_por: string | null
          created_at: string | null
          data_recebimento: string | null
          fornecedor_id: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          pedido_compra_id: string
          status: string | null
        }
        Insert: {
          conferido_por?: string | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_id: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          pedido_compra_id: string
          status?: string | null
        }
        Update: {
          conferido_por?: string | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          pedido_compra_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
          {
            foreignKeyName: "recebimentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      regras_precificacao: {
        Row: {
          ativo: boolean | null
          categoria: string
          created_at: string | null
          criado_por: string | null
          desconto_maximo: number | null
          descricao: string | null
          id: string
          markup_maximo: number | null
          markup_minimo: number
          markup_sugerido: number
          preco_m2_minimo: number | null
          taxa_urgencia: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          criado_por?: string | null
          desconto_maximo?: number | null
          descricao?: string | null
          id?: string
          markup_maximo?: number | null
          markup_minimo?: number
          markup_sugerido?: number
          preco_m2_minimo?: number | null
          taxa_urgencia?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          criado_por?: string | null
          desconto_maximo?: number | null
          descricao?: string | null
          id?: string
          markup_maximo?: number | null
          markup_minimo?: number
          markup_sugerido?: number
          preco_m2_minimo?: number | null
          taxa_urgencia?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_precificacao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_precificacao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          custo_hora: number
          descricao: string | null
          horas_estimadas: number | null
          id: string
          nome: string
          preco_fixo: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_hora?: number
          descricao?: string | null
          horas_estimadas?: number | null
          id?: string
          nome: string
          preco_fixo?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_hora?: number
          descricao?: string | null
          horas_estimadas?: number | null
          id?: string
          nome?: string
          preco_fixo?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      solicitacoes_compra: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          numero: string | null
          observacoes: string | null
          origem: string | null
          quantidade: number
          referencia_id: string | null
          referencia_tipo: string | null
          solicitante_id: string | null
          status: string | null
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          quantidade: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          quantidade?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_compra_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_compra_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_compra_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          brand: string | null
          cliente_id: string | null
          cliente_unidade_id: string | null
          cnpj: string | null
          code: string | null
          corporate_name: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string | null
          neighborhood: string | null
          phone: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          brand?: string | null
          cliente_id?: string | null
          cliente_unidade_id?: string | null
          cnpj?: string | null
          code?: string | null
          corporate_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          brand?: string | null
          cliente_id?: string | null
          cliente_unidade_id?: string | null
          cnpj?: string | null
          code?: string | null
          corporate_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      tarefas_campo: {
        Row: {
          created_at: string | null
          fim: string | null
          id: string
          inicio: string | null
          latitude_fim: number | null
          latitude_inicio: number | null
          longitude_fim: number | null
          longitude_inicio: number | null
          observacoes: string | null
          ordem_instalacao_id: string
          status: string | null
          tecnico_id: string
        }
        Insert: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          latitude_fim?: number | null
          latitude_inicio?: number | null
          longitude_fim?: number | null
          longitude_inicio?: number | null
          observacoes?: string | null
          ordem_instalacao_id: string
          status?: string | null
          tecnico_id: string
        }
        Update: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          latitude_fim?: number | null
          latitude_inicio?: number | null
          longitude_fim?: number | null
          longitude_inicio?: number | null
          observacoes?: string | null
          ordem_instalacao_id?: string
          status?: string | null
          tecnico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_tasks_ordem_instalacao_id_fkey"
            columns: ["ordem_instalacao_id"]
            isOneToOne: false
            referencedRelation: "ordens_instalacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_tasks_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_tasks_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      tarefas_comerciais: {
        Row: {
          created_at: string | null
          data_conclusao: string | null
          data_prevista: string | null
          descricao: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          prioridade: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_comerciais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_comerciais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      templates_orcamento: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          itens: Json
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_orcamento_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_orcamento_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ativo: boolean | null
          capacidade_kg: number | null
          created_at: string | null
          equipe_id: string | null
          id: string
          modelo: string | null
          placa: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          capacidade_kg?: number | null
          created_at?: string | null
          equipe_id?: string | null
          id?: string
          modelo?: string | null
          placa: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          capacidade_kg?: number | null
          created_at?: string | null
          equipe_id?: string | null
          id?: string
          modelo?: string | null
          placa?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_campo_fotos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          job_id: string | null
          loja_marca: string | null
          loja_nome: string | null
          note: string | null
          ordem_instalacao_id: string | null
          os_number: string | null
          pedido_id: string | null
          photo_type: string | null
          photo_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["job_id"]
          },
        ]
      }
      vw_campo_instalacoes: {
        Row: {
          assigned_to: string | null
          cliente_id: string | null
          cliente_unidade_id: string | null
          created_at: string | null
          data_agendada: string | null
          duracao_minutos: number | null
          finished_at: string | null
          fotos_antes: number | null
          fotos_depois: number | null
          issues: string | null
          job_id: string | null
          lat: number | null
          lng: number | null
          loja_endereco: string | null
          loja_estado: string | null
          loja_marca: string | null
          loja_nome: string | null
          notes: string | null
          ordem_instalacao_id: string | null
          os_number: string | null
          pedido_id: string | null
          pedido_item_id: string | null
          signature_url: string | null
          started_at: string | null
          status_campo: string | null
          store_id: string | null
          tecnico_id: string | null
          tecnico_nome: string | null
          tecnico_role: string | null
          tipo_servico: string | null
          total_videos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "vw_campo_instalacoes"
            referencedColumns: ["tecnico_id"]
          },
        ]
      }
      vw_modelos_completos: {
        Row: {
          altura_cm: number | null
          area_m2: number | null
          ativo: boolean | null
          categoria_nome: string | null
          categoria_slug: string | null
          descritivo_nf: string | null
          descritivo_tecnico: string | null
          garantia_descricao: string | null
          garantia_meses: number | null
          id: string | null
          largura_cm: number | null
          linha_qualidade: string | null
          margem_minima: number | null
          markup_padrao: number | null
          nome: string | null
          produto_categoria: string | null
          produto_categoria_id: string | null
          produto_codigo: string | null
          produto_id: string | null
          produto_nome: string | null
          requer_instalacao: boolean | null
          tempo_producao_min: number | null
          tipo_checklist_instalacao: string | null
          total_materiais: number | null
          total_processos: number | null
          unidade_venda: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_modelos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["produto_categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fiscal_proximo_numero_serie: {
        Args: { p_serie_id: string }
        Returns: number
      }
      fiscal_registrar_auditoria: {
        Args: {
          p_acao: string
          p_antes?: Json
          p_depois?: Json
          p_entidade: string
          p_entidade_id: string
          p_metadados?: Json
          p_resultado: string
          p_user_id: string
        }
        Returns: undefined
      }
      fiscal_validar_cliente_nfe: {
        Args: { p_cliente_id: string }
        Returns: {
          mensagem: string
          ok: boolean
        }[]
      }
      fiscal_validar_pedido_nfe: {
        Args: { p_pedido_id: string }
        Returns: {
          mensagem: string
          ok: boolean
        }[]
      }
      gerar_numero_op: { Args: never; Returns: string }
      gerar_numero_os: { Args: never; Returns: string }
      gerar_numero_pedido: { Args: never; Returns: string }
      gerar_numero_proposta: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      limpar_auditoria_antiga: { Args: never; Returns: number }
      next_nosso_numero: {
        Args: { p_bank_account_id: string }
        Returns: string
      }
      portal_aprovar_proposta: {
        Args: { p_comentario?: string; p_token: string }
        Returns: Json
      }
      portal_get_proposta: { Args: { p_token: string }; Returns: Json }
      portal_heartbeat: {
        Args: {
          p_clicked_items: Json
          p_downloaded_pdf: boolean
          p_duration_seconds: number
          p_max_scroll_depth: number
          p_token: string
          p_view_id: string
        }
        Returns: undefined
      }
      portal_register_attachment: {
        Args: {
          p_nome_arquivo: string
          p_onedrive_file_id: string
          p_onedrive_file_url: string
          p_tamanho_bytes: number
          p_tipo_mime: string
          p_token: string
          p_uploaded_by_name: string
        }
        Returns: string
      }
      portal_register_view: {
        Args: {
          p_browser: string
          p_device_type: string
          p_geo_city: string
          p_geo_country: string
          p_geo_region: string
          p_os: string
          p_session_id: string
          p_token: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
