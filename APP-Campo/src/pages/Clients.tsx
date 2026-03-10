import React from "react";
import Stores from "./Stores";

export default function Clients() {
  // Como Lojas e Clientes compartilham a mesma base de dados (tabela 'stores'),
  // renderizamos o mesmo componente que já gerencia ambos de forma unificada.
  return <Stores />;
}