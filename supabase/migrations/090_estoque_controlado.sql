-- Migration 090 — Campo estoque_controlado em materiais
-- Permite pular reserva de estoque para matérias sem controle formal
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS estoque_controlado boolean DEFAULT false;
COMMENT ON COLUMN materiais.estoque_controlado IS 'Se false, reserva de estoque é ignorada para este material';
