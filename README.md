# Questão de Ritmo

Planejador de estudos para concursos com painel de desempenho, edital, ciclos por progresso, revisões, simulados e materiais organizados por assunto.

## Cadernos de questões externos

Em **Edital** ou **Hoje**, use **Buscar questões** ao lado de um assunto. O nome já aparece preenchido e pode ser ajustado antes da busca. **Buscar no Qconcursos** abre questões por palavra-chave; confira os filtros de disciplina e assunto. Para o **TEC Concursos**, copie o assunto, abra a plataforma e escolha seus filtros. A criação e o salvamento do caderno são feitos na sua conta da plataforma externa. Depois cole a URL nos campos de cadernos e salve: o link ficará disponível diretamente naquele assunto, inclusive após recarregar a página. O aplicativo não recebe credenciais dessas plataformas e não sincroniza automaticamente as questões resolvidas nelas.

## Interface

Identidade em azul profundo e turquesa, símbolo Q com check, ícones duotone, navegação lateral e temas claro e escuro. O tema claro é o padrão para novas visitas; sua escolha anterior é preservada e pode ser alterada em **Ajustes**. A interface se adapta ao celular e oferece indicação visível de foco para navegação por teclado. As matérias mantêm seus títulos, com assuntos organizados em tabela: situação, questões, cadernos e ações. Na tela de hoje, os controles também ficam alinhados por assunto.

As capturas abaixo mostram a aplicação real com dados fictícios de demonstração. Nenhuma conta, questão de prova ou informação de usuário real foi usada nas imagens.

### Painel, concursos e revisões

![Painel com desempenho por matéria e ciclo de estudos](docs/images/painel.png)

![Concursos com banca, cargo, fase e indicadores](docs/images/concursos.png)

![Fila de revisões com prioridades e filtros](docs/images/revisoes.png)

### Simulados, materiais e modelos

![Evolução dos simulados e desempenho por matéria](docs/images/simulados.png)

![Materiais vinculados ao assunto](docs/images/materiais.png)

![Prévia de modelo antes de criar um novo concurso](docs/images/importacao.png)

### Seu plano de hoje

![Painel de hoje com metas, sequência, desempenho e atividades em tema claro](docs/images/hoje.png)

### Entrada

![Tela de entrada com a nova identidade visual](docs/images/entrada.png)

### Edital e caderno de erros

![Edital com matérias e assuntos organizados](docs/images/edital.png)

![Caderno de erros com histórico e opção de refazer a questão](docs/images/caderno.png)

### Tema escuro e celular

![Painel no tema escuro](docs/images/painel-escuro.png)

<img src="docs/images/painel-mobile.png" alt="Painel adaptado para celular" width="390" />

![Painel de hoje no tema escuro](docs/images/hoje-escuro.png)

<img src="docs/images/hoje-mobile.png" alt="Painel de hoje adaptado para celular" width="390" />

<img src="docs/images/edital-mobile.png" alt="Assuntos do edital com colunas adaptadas para celular" width="390" />

## Funcionalidades

- **Painel:** visão por matéria, cobertura do edital, questões praticadas, último simulado e ciclo ou cronograma ao lado.
- **Simulados:** registro manual por matéria, pesos, evolução das notas e comparação de desempenho; resultados separados das questões praticadas. A nota é a porcentagem ponderada de acertos, sem penalidade por erro.
- **Materiais:** PDFs, vídeos, cadernos e outros links por assunto, salvos junto aos links externos.
- **Modelos:** prévia, importação e exportação de estrutura do edital, sempre criando um novo concurso e preservando os existentes.
- **Hoje:** assuntos novos e reforços, conclusão de cards, cronômetros e registro de questões.
- **Semana:** previsão de matérias para 35 dias. A previsão é estimada: o ciclo avança conforme a conclusão real dos estudos.
- **Edital:** cadastro manual, importação de texto numerado ou no formato `Matéria: assunto; assunto`, catálogo compartilhado de matérias, anotações e links por assunto.
- **Metas:** matérias e assuntos por dia, duração de sessões, descanso e quantidade de revisões.
- **Planejamento:** ciclo por progresso ou cronograma fixo por dia da semana. Pendências continuam no ciclo até serem concluídas.
- **Revisões:** fila com filtros por vencimento, baixo desempenho e assunto; botão para incluir no plano de hoje. Intervalos de 1, 3, 7, 15 e 30 dias, com limite diário configurável. As revisões vêm de todas as matérias, independentemente das matérias novas do dia.
- **Caderno:** erros para refazer, histórico por questão e anotações. Um erro deixa a lista de pendências quando a última resposta passa a ser correta; as tentativas anteriores continuam no histórico.
- **Questões:** banco extraído de provas, seleção por matéria/assunto/banca, correção no servidor e registro individual de respostas. Cada tentativa tem identificador próprio para impedir duplicação em uma repetição da requisição.
- **Links:** Qconcursos, Tec Concursos e outro caderno podem coexistir em cada assunto. Links antigos continuam disponíveis.
- **Progresso:** atividade, sequência, minutos e desempenho. Dias de descanso configurados não interrompem a sequência.
- **Concursos:** cartões com banca, cargo, fase, edital, data da prova, cobertura e indicadores. Tempo de estudo estimado a partir das sessões concluídas e metas, identificado como estimativa. Reinício de ciclo com opção de preservar o histórico.
- **Conta:** perfil, ranking opcional, senha, código de recuperação e uma sessão ativa por conta.
- **Administração:** usuários, catálogo, recursos, auditoria e backups.
- **PWA:** instalação, notificações opcionais e aviso de atualização. Os recursos de estudo dependem da API; instalar o PWA não fornece funcionamento completo offline.

## Modelos de edital

Em **Concursos**, escolha um modelo inicial, importe um JSON ou cole a estrutura. Confira a prévia e clique em **Importar como novo concurso**. Os exemplos de Área administrativa e Tribunais são pontos de partida; confira e adapte ao edital oficial. O exportador gera o mesmo formato, sem progresso ou simulados:

```json
{
  "name": "Meu concurso",
  "banca": "FGV",
  "cargo": "Técnico",
  "materias": [
    { "name": "Português", "topics": [{ "name": "Crase" }] }
  ]
}
```

O importador aceita até 2 MiB, 200 matérias e 1.000 assuntos por matéria. Novos identificadores são gerados e o progresso começa zerado. Para recuperar o histórico de um plano, use o backup em **Ajustes**.

## Executar localmente

Use **Node.js 22.13 ou superior**. `.nvmrc` indica a versão principal usada no CI.

```bash
npm ci
cp .env.example .env
# Preencha JWT_SECRET com um segredo gerado para esta instalação.
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run dev
```

O Vite normalmente abre em `http://localhost:5173`. A API usa a porta 4000 e o proxy de desenvolvimento encaminha `/api` para ela. Para VAPID, gere as chaves indicadas em `.env.example` e preencha as duas variáveis; notificações são opcionais.

```bash
npm run dev:client  # Vite
npm run dev:server  # API com reinício em alterações de código
npm test           # testes unitários e de integração com banco isolado
npm run build      # frontend e service worker em dist/
npm run check      # testes e build
npm start          # API e frontend compilado, na mesma origem
npm run preview    # prévia estática do build; não inicia a API
```

## Proteção do progresso

A aplicação só permite salvar depois de carregar o plano com sucesso. Uma falha de leitura mostra uma mensagem e a opção de tentar novamente, sem substituir dados por um plano novo.

O salvamento usa uma fila com uma requisição por vez e agrupa alterações próximas. A tela informa quando está aguardando, salvando, salvo ou com erro. Falhas transitórias têm até três novas tentativas automáticas; também é possível tentar manualmente ou ao reconectar.

Cada gravação exige a versão lida pelo navegador. Se outra aba salvar primeiro, a API retorna `409 PLAN_CONFLICT` e preserva o plano do servidor. A aba em conflito mantém as alterações locais e oferece um download antes de recarregar. Repetir uma gravação já confirmada no servidor, cuja resposta foi perdida, não cria uma nova versão desnecessária.

Alterações pendentes também ficam no armazenamento local do navegador, separadas por conta. Ao reabrir, a aplicação primeiro consulta o servidor e recupera a cópia local; uma versão incompatível é apresentada como conflito e nunca sobrescreve automaticamente o servidor. Se o navegador bloquear ou ficar sem espaço no armazenamento local, as alterações permanecem na memória da aba e o aviso ao sair continua ativo. Em um computador compartilhado, baixe ou conclua o salvamento das pendências e limpe os dados do site antes de entregar o dispositivo.

A API e o importador de backups validam a estrutura do plano, listas, contagens e links. JSON sem a estrutura esperada é rejeitado. Backups antigos de um único concurso continuam aceitos.

## Dados e recuperação

O SQLite guarda contas, planos, histórico individual de questões, catálogo, questões, notificações e auditoria. `SQLITE_PATH` e `BACKUP_DIR` podem apontar para volumes persistentes; sem configuração, ficam em `server/data.sqlite` e `server/backups`.

O JSON exportado em Ajustes contém concursos, planos, anotações e histórico de atividade. O histórico individual de respostas às questões pertence à conta no servidor e é preservado pelo **backup SQLite completo**, não pelo JSON do plano. Importar JSON não apaga esse histórico de respostas. Os ids de concursos/assuntos do backup mantêm o vínculo com ele.

O código de recuperação é mostrado no cadastro e substituído após o uso. Guarde-o com segurança: sem ele e sem a senha, a recuperação exige intervenção administrativa. Não há envio por e-mail implementado.

## Backups e restauração

A API cria um snapshot consistente com `VACUUM INTO` ao iniciar e a cada 12 horas, além do acionamento manual pelo administrador. São mantidos os 14 arquivos mais recentes.

Para proteger contra perda do servidor, monte um volume de backup externo e configure `BACKUP_REPLICA_DIR`. A aplicação copia cada snapshot, compara SHA-256 e publica o arquivo por renomeação, mantendo também 14 réplicas. O código não provisiona armazenamento remoto: essa variável precisa apontar para o volume que você efetivamente montou. Falhas de cópia são registradas, e o snapshot local é preservado.

Para restaurar:

1. Pare a API e mantenha-a parada durante a restauração.
2. Escolha um snapshot SQLite local ou uma cópia da réplica.
3. Execute:

```bash
npm run restore -- --source /caminho/backup.sqlite --target /caminho/data.sqlite --server-stopped
```

4. Inicie a API e confira o login e o plano restaurado.

A ferramenta verifica a integridade e as tabelas antes de substituir o banco. O banco anterior e seus arquivos auxiliares são preservados com sufixo `.before-restore-*` para retorno à versão anterior. O arquivo de origem permanece intacto. Os testes exercitam restauração e rejeição de arquivos inválidos; faça também um ensaio com uma cópia do seu backup de produção.

## Produção

Para login e dados funcionarem, hospede a API e o build **na mesma origem**, com HTTPS e um volume persistente para o SQLite. O Express serve `dist/` e `/api`.

```bash
npm ci
npm run check
NODE_ENV=production npm start
```

Configure um `JWT_SECRET` próprio com pelo menos 32 caracteres. Em produção, a API recusa iniciar sem ele ou com o exemplo antigo. O cookie usa `httpOnly`, `sameSite=lax` e `secure` em produção.

A aplicação confia em um proxy reverso. Ajuste essa configuração em `server/index.js` se a topologia real usar uma quantidade diferente de proxies. Use um supervisor de processos para reiniciar a API e mantenha as variáveis e os volumes fora do repositório.

### Oracle: deploy automático da main

A instalação principal é `https://app.paulobruno.dev`, na Oracle. A Cloudflare cuida do domínio. A API roda como usuário `opc`, pelo serviço systemd `rota-app`, em `/home/opc/app`, usando `/usr/local/bin/node` (22.13 ou superior).

O workflow já inclui **Deploy Oracle**, executado após **Test and build** em pushes para `main` e execuções manuais. Ele fica desativado até a configuração abaixo estar completa. Os arquivos são entregues por SSH; a VM não precisa ter Git instalado.

Em **Settings > Secrets and variables > Actions** do repositório:

1. Na aba **Secrets**, crie `ORACLE_SSH_KEY` com uma chave SSH privada autorizada para o usuário `opc`. Prefira uma chave dedicada à automação. Ela deve ser cadastrada somente como secret; nunca em commits, issues ou no chat.
2. Crie `ORACLE_KNOWN_HOSTS` com a entrada correspondente à VM no arquivo `known_hosts` de uma conexão SSH que você já verificou. O workflow exige verificação da identidade do servidor e não aceita hosts desconhecidos automaticamente.
3. Na aba **Variables**, crie `ORACLE_DEPLOY_ENABLED` com valor `true`. Esse é o último passo de ativação. `ORACLE_HOST` e `ORACLE_USER` são opcionais; os padrões são `150.230.72.89` e `opc`.
4. Abra **Actions > Tests and deploy > Run workflow**, selecione `main` e execute. Depois, cada envio para `main` também publica na Oracle. Uma execução cujo commit deixou de ser a ponta da `main` é ignorada na etapa de entrega.

A porta SSH deve ser acessível pelo runner do GitHub. O usuário precisa executar `systemctl stop rota-app` e `systemctl start rota-app` via `sudo` sem senha; configure permissão limitada a esses comandos se necessário. O script requer `npm`, `rsync`, `tar`, `curl`, `cmp` e `flock`, além do Node e do systemd. A configuração existente deve ter um `JWT_SECRET` próprio de pelo menos 32 caracteres e o banco deve existir.

O deploy instala dependências em uma pasta de release antes de parar o serviço. Confere o diretório do systemd e valida a configuração existente sem imprimir segredos. Com o serviço parado, guarda uma cópia completa da instalação e um snapshot SQLite consistente em `/home/opc/.rota-deploy-backups/`. Atualiza código, dependências e build, preservando `.env`, banco e backups existentes. Verifica o identificador do commit publicado e a resposta da API em localhost.

Se a atualização ou a verificação de saúde falhar, tenta retornar ao código/dependências anteriores e iniciar o serviço. O banco atual permanece intacto; migrações são aditivas. O snapshot é preservado para restauração manual, que deve seguir o procedimento descrito acima. Falhas no retorno também são reportadas nos logs. O deploy não troca chaves JWT, não modifica o serviço systemd nem provisiona infraestrutura da Oracle.

Os arquivos de release e backup são mantidos para recuperação. Monitore o espaço da VM e defina uma política de retenção para `/home/opc/.rota-releases/` e `/home/opc/.rota-deploy-backups/`.

### GitHub Pages

O workflow `.github/workflows/deploy.yml` roda testes e build no Node indicado em `.nvmrc`. Só publica depois da aprovação dessas etapas, em pushes/execuções manuais da `main`. Pull requests são verificados sem publicação.

Em **Settings > Pages**, selecione **GitHub Actions**. Em proteção da branch, exija o check **Test and build** antes de mesclar alterações.

GitHub Pages publica apenas arquivos estáticos e não executa Express/SQLite. A aplicação usa `/api` na mesma origem, portanto essa publicação isolada não oferece login funcional. Para a aplicação completa, use a hospedagem descrita acima. O manifesto PWA usa caminhos relativos para também respeitar instalações em subdiretórios.

## Estrutura

```text
server/
  index.js          # configuração, autenticação, administração e ranking
  routes/data.js    # plano validado e gravação com controle de versão
  routes/questions.js # questões, respostas e histórico por conta
  db.js             # SQLite e evolução de schema sem ignorar erros inesperados
  backup.js         # snapshots, réplica e retenção
  restore.js        # restauração offline validada
src/
  App.jsx           # navegação e coordenação do planejamento
  api/              # chamadas HTTP
  lib/              # planejador, validação, fila de persistência e hooks
  views/            # telas de estudo, caderno, configurações e administração
  components/       # cronômetros, quiz, links e estado de salvamento
  data/             # modelo e migração de planos antigos
test/               # testes unitários, API, DOM, conflitos, recuperação e backups
```

As versões das dependências principais estão fixadas; `package-lock.json` deve acompanhar qualquer atualização. O projeto ainda não possui uma licença definida.
