# Levantamento funcional e implementação independente

Referência observada com acesso fornecido pelo usuário: painel, desempenho, planejamento, alertas, caderno externo, marcações, prática livre, rankings, comunidade, extensão, perfil e ajuda. Inspeção de controles e formulários sem concluir tarefas, alterar o plano, entrar no grupo, contratar serviços ou instalar a extensão de terceiros.

## Recursos observados

| Área | Comportamentos observados | Situação neste projeto |
| --- | --- | --- |
| Painel | Fila, tarefa atual, tempo, acumulado, próximos assuntos, meta semanal, prazo | Nova fila intercalada, cronômetro persistente por conta/edital/dia/assunto, tempo medido e conclusão manual; meta, prazo e atalhos |
| Calendário | Semana, navegação e distribuição conforme horas | Histórico de sessões passadas e simulação futura sequencial, respeitando horas, dependências e revisões estimadas |
| Desempenho | Períodos, volume, aproveitamento, matéria, tópico, registros externos | Períodos globais, filtros de matéria/assunto nos registros datados, barras diárias, acumulado compartilhado por assunto, últimas sessões e registro externo |
| Planejamento | Modo por matéria, frequência, ativação, teoria, prioridade, duração e dependência | Configuração por matéria e assunto, horas por dia, frequência relativa com turnos adicionais, validação de dependências e reserva para revisão |
| Revisões | Intervalos dependem do desempenho, amostra, peso, importância e prova | Algoritmo próprio e explícito; não é uma reprodução do algoritmo interno da referência |
| Alertas | Acumulado e prática recente abaixo de corte por importância | Cortes 80/70/60, amostra mínima de 10, média recente disponível e revisões atrasadas |
| Caderno externo | Links de questões, notas e agenda por avaliação | URLs fornecidas pelo usuário, avaliações, agenda separada, arquivamento e restauração |
| Marcações | Trechos, notas, fonte e busca | Registro por assunto, busca, cores, arquivamento, revisão ativa com agenda, exportação Markdown e importação de extensão própria |
| Questões avulsas | Cadernos por disciplina e banca, prática livre | Cadernos próprios por banca/assunto, assistência TEC, importação CSV/TSV/JSON com prévia, equivalências com origem, registro de prática, busca, paginação e diagnóstico por plataforma; links e banco próprio existentes |
| Rankings | Volume, acerto, sequência, períodos, participação opcional | Ranking próprio por volume, aproveitamento com amostra mínima, sequência de dias e área declarada; somente participantes voluntários |
| Perfil | Conta, estudo, horários, reinício e assinatura | Perfil e reinício existentes preservados; horas por dia adicionadas ao planejamento |
| Comunidade | Convite de grupo e regras | Convite configurável para o grupo do proprietário; não utiliza o convite da referência |
| Ajuda | Artigos de método e suporte | Ajuda local sobre os recursos implementados; atendimento humano não é simulado |
| Extensão | Captura, grifos, leitor PDF, revisão, Pomodoro, foco e exportação | Captura, restauração de grifos com acesso opcional por site, revisão, Pomodoro persistente, modo foco e exportação JSON/Markdown; leitor PDF próprio na plataforma |

## Limites de equivalência

A inspeção mostra interfaces e regras descritas ao usuário, não código-fonte, banco de dados, fórmulas completas ou serviços internos. Nenhum catálogo, caderno compartilhado da referência, guia pago, imagem da marca, credencial, dado pessoal ou lista de alunos foi inserido no repositório.

O leitor PDF da plataforma abre arquivos locais de até 30 MB, grava grifos por documento/página/assunto com proteção contra seleções desatualizadas, oferece busca em todas as páginas, captura explícita da seleção, revisão ativa e exporta uma cópia com grifos desenhados e apêndice de notas. A identificação SHA-256 permite restaurar grifos ao reabrir o mesmo arquivo. Não envia o arquivo original ao servidor. PDFs escaneados não têm OCR e arquivos protegidos exigem uma cópia desbloqueada.

Cobrança/assinatura, atendimento humano e catálogo comercial estão fora do escopo por decisão do proprietário. Não implementar esses serviços. A integração automática com resultados externos depende de APIs oficiais; atualmente os resultados são lançados manualmente. O catálogo por banca aceita cadernos próprios, a comunidade aceita convite próprio e a ajuda explica as funções locais. As fórmulas de planejamento/revisão são independentes e não pretendem reproduzir algoritmos internos inacessíveis. A projeção semanal supõe a conclusão das tarefas propostas e estima intervalos pelo desempenho atual; resultados futuros podem mudar a agenda.

A demonstração pública usa dados fictícios em memória e não acessa APIs da conta. Não é um bypass do login; endpoints reais continuam autenticados.

## Registro e compatibilidade

A nova fila é uma alternativa ao ciclo individual e ao plano integrado. Cada sessão registra uma atividade e suas questões apenas no assunto de origem; a prática equivalente continua derivada. Usar várias rotinas para lançar o mesmo estudo físico duplica registros por ação do usuário, portanto execute uma rotina por estudo.

Teoria concluída não inventa questões. Prática registrada em Desempenho não conclui tarefa. Revisão de um link externo não soma questões ao desempenho global. Planejamento altera somente configurações; preserva contagens, notas e histórico. Dados antigos continuam validados e aceitos.
