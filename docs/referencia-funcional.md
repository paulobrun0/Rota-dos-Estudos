# Levantamento funcional e implementação independente

Referência observada com acesso fornecido pelo usuário: painel, desempenho, planejamento, alertas, caderno externo, marcações, prática livre, rankings, comunidade, extensão, perfil e ajuda. Inspeção de controles e formulários sem concluir tarefas, alterar o plano, entrar no grupo, contratar serviços ou instalar a extensão de terceiros.

## Recursos observados

| Área | Comportamentos observados | Situação neste projeto |
| --- | --- | --- |
| Painel | Fila, tarefa atual, tempo, acumulado, próximos assuntos, meta semanal, prazo | Nova fila intercalada, sessão com cronômetro e conclusão manual; meta, prazo e atalhos |
| Calendário | Semana, navegação e distribuição conforme horas | Projeção semanal baseada no progresso atual, com aviso de que não é um cronograma garantido |
| Desempenho | Períodos, volume, aproveitamento, matéria, tópico, registros externos | Períodos globais, barras diárias, acumulado compartilhado por assunto, últimas sessões e registro externo |
| Planejamento | Modo por matéria, frequência, ativação, teoria, prioridade, duração e dependência | Configuração por matéria e assunto, horas por dia, validação de dependências e reserva para revisão |
| Revisões | Intervalos dependem do desempenho, amostra, peso, importância e prova | Algoritmo próprio e explícito; não é uma reprodução do algoritmo interno da referência |
| Alertas | Acumulado e prática recente abaixo de corte por importância | Cortes 80/70/60, amostra mínima de 10, média recente disponível e revisões atrasadas |
| Caderno externo | Links de questões, notas e agenda por avaliação | URLs fornecidas pelo usuário, avaliações, agenda separada, arquivamento e restauração |
| Marcações | Trechos, notas, fonte e busca | Registro por assunto, busca, cores, arquivamento e importação de extensão própria |
| Questões avulsas | Cadernos por disciplina e banca, prática livre | Links e materiais do usuário e prática no banco próprio existente |
| Rankings | Volume, acerto, sequência, períodos, participação opcional | Ranking próprio existente preservado; segmentação por área da referência não foi incorporada |
| Perfil | Conta, estudo, horários, reinício e assinatura | Perfil e reinício existentes preservados; horas por dia adicionadas ao planejamento |
| Comunidade | Convite de grupo e regras | Convite configurável para o grupo do proprietário; não utiliza o convite da referência |
| Ajuda | Artigos de método e suporte | Ajuda local sobre os recursos implementados; atendimento humano não é simulado |
| Extensão | Captura, grifos, leitor PDF, revisão, Pomodoro, foco e exportação | Extensão própria de captura/notas/exportação; Pomodoro na plataforma |

## Limites de equivalência

A inspeção mostra interfaces e regras descritas ao usuário, não código-fonte, banco de dados, fórmulas completas ou serviços internos. Nenhum catálogo, caderno compartilhado da referência, guia pago, imagem da marca, credencial, dado pessoal ou lista de alunos foi inserido no repositório.

A extensão própria **não possui** leitor de PDF com grifos e exportação de PDF anotado, restauração automática de grifos nas páginas ou modo de leitura que remove anúncios. Esses recursos da referência continuam pendentes. Também não há atendimento humano, cobrança/assinatura, catálogo comercial por banca ou integração automática com resultados de sites externos. Eles precisam de conteúdo próprio, regras e/ou infraestrutura específica.

A demonstração pública usa dados fictícios em memória e não acessa APIs da conta. Não é um bypass do login; endpoints reais continuam autenticados.

## Registro e compatibilidade

A nova fila é uma alternativa ao ciclo individual e ao plano integrado. Cada sessão registra uma atividade e suas questões apenas no assunto de origem; a prática equivalente continua derivada. Usar várias rotinas para lançar o mesmo estudo físico duplica registros por ação do usuário, portanto execute uma rotina por estudo.

Teoria concluída não inventa questões. Prática registrada em Desempenho não conclui tarefa. Revisão de um link externo não soma questões ao desempenho global. Planejamento altera somente configurações; preserva contagens, notas e histórico. Dados antigos continuam validados e aceitos.
