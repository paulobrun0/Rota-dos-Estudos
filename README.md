# Ciclo de Estudos

Um planejador de estudos para concursos, criado para transformar um edital extenso em uma rotina clara, distribuída e sustentável.

A aplicação organiza matérias e assuntos em ciclos, monta o plano diário automaticamente, acompanha o progresso e evita que um assunto reapareça antes da hora.

## Visão geral

- Planejamento diário baseado nas suas metas.
- Distribuição automática de matérias e assuntos.
- Ciclos sem repetição prematura de assuntos.
- Revisão quando o assunto reaparece em um novo ciclo.
- Acompanhamento de sequência, recorde e atividade.
- Suporte a vários concursos no mesmo aplicativo.
- Login por usuário, com dados salvos num banco local por conta.
- Deploy do front-end preparado para GitHub Pages.

## Funcionalidades

### Hoje

A visão diária reúne o que precisa ser estudado na data selecionada:

- Navegação entre dias.
- Percentual de conclusão.
- Cards agrupados por matéria.
- Marcação de assuntos concluídos.
- Indicador de assuntos novos ou em revisão de ciclo.
- Cronômetro individual por matéria.
- Atalho para voltar ao dia atual.

Ao concluir um assunto novo, ele deixa de ser pendente e passa a fazer parte do histórico de estudos.

### Semana

A visão semanal apresenta cinco semanas consecutivas, totalizando 35 dias planejados:

- Semana atual e semanas futuras na mesma tela.
- Consulta rápida sem avançar manualmente pelas setas.
- Quantidade de cards por dia.
- Progresso diário.
- Acesso direto ao plano de qualquer data.

As setas continuam disponíveis para navegar para semanas anteriores ou posteriores.

### Edital

Cadastre o conteúdo que será estudado de duas formas:

1. Adicionando matérias e assuntos manualmente.
2. Importando várias matérias de uma vez.

Formato da importação em lote:

```text
Direito Administrativo: Regime Jurídico; Poderes Administrativos; Atos Administrativos
Português: Crase; Ortografia; Interpretação de Texto
Informática: Windows; Internet; Segurança da Informação
```

Cada linha representa uma matéria. Separe os assuntos usando ponto e vírgula.

Também é possível:

- Adicionar assuntos individualmente.
- Remover assuntos.
- Remover matérias.
- Evitar duplicidades por nome.

### Metas

Defina como o plano deve ser distribuído:

- **Matérias por dia:** quantas matérias entram na rotação diária.
- **Assuntos por matéria:** quantos assuntos novos são planejados por aparição da matéria.
- **Minutos por matéria:** duração sugerida para cada sessão.

Quando as metas mudam, os próximos 35 dias são recalculados automaticamente.

### Ciclos e revisões

O planejamento usa uma reserva compartilhada para impedir repetições antecipadas:

1. Os assuntos pendentes são distribuídos uma vez.
2. Cada matéria avança conforme a rotação configurada.
3. Quando todos os assuntos daquela matéria forem consumidos, começa um novo ciclo.
4. No novo ciclo, os assuntos reaparecem como revisão de ciclo.

Não há revisões automáticas em 1, 3, 7 ou 15 dias. O aplicativo não agenda uma revisão por data: a revisão acontece quando o assunto voltar naturalmente no ciclo.

### Progresso

Acompanhe a consistência dos estudos com:

- Sequência atual.
- Maior sequência registrada.
- Total de cards concluídos.
- Dias com atividade.
- Mapa visual de atividade das últimas 18 semanas.

### Concursos

Organize vários objetivos de estudo no mesmo lugar:

- Criar concursos diferentes.
- Alternar entre concursos.
- Renomear concursos.
- Excluir concursos.
- Manter matérias, metas e planos separados por concurso.

## Tecnologias

**Front-end**
- React + Vite
- Lucide React (ícones)
- JavaScript/JSX
- CSS inline e estilos locais do componente

**Back-end** (local, veja [Autenticação e banco de dados](#autenticação-e-banco-de-dados))
- Node.js + Express
- SQLite embutido do Node (`node:sqlite`, sem dependências nativas)
- Autenticação por sessão: senha com hash (bcrypt) + cookie httpOnly assinado (JWT)

## Como executar localmente

Pré-requisito: Node.js 22.5+ (usa o módulo `node:sqlite`).

```bash
npm install
cp .env.example .env   # gere um JWT_SECRET próprio antes de usar em produção
npm run dev
```

Isso sobe o front-end e a API juntos. Abra o endereço exibido pelo Vite, normalmente:

```text
http://localhost:5173/
```

## Scripts disponíveis

```bash
npm run dev         # front-end (Vite) + API (Express), juntos
npm run dev:client  # só o front-end
npm run dev:server  # só a API
npm run build        # gera a versão de produção do front-end em dist/
npm run preview      # serve a versão de produção do front-end localmente
```

## Publicação no GitHub Pages

O projeto já possui um workflow em `.github/workflows/deploy.yml`.

Para publicar:

1. Crie um repositório vazio no GitHub.
2. Envie o projeto para a branch `main`.
3. No repositório, abra **Settings > Pages**.
4. Em **Build and deployment**, selecione **GitHub Actions**.
5. A cada push na `main`, o GitHub instalará as dependências, executará o build e publicará a aplicação.

Exemplo de primeiro envio:

```bash
git init
git add .
git commit -m "Configura projeto"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ciclo-foco.git
git push -u origin main
```

O Vite está configurado com `base: "./"`, permitindo que a aplicação funcione no endereço de projeto do GitHub Pages sem precisar alterar o nome do repositório.

## Estrutura principal

```text
.
├── .github/workflows/deploy.yml  # deploy automático do front-end no GitHub Pages
├── index.html                    # documento HTML principal
├── vite.config.js                # configuração do Vite (inclui proxy de /api para a API local)
├── package.json                  # scripts e dependências
├── server/                       # API local (Express + SQLite)
│   ├── index.js                  # rotas: auth (register/login/logout/me) e dados do plano
│   ├── auth.js                   # emissão/validação do JWT de sessão
│   └── db.js                     # schema e conexão SQLite
└── src/                          # aplicação React
    ├── main.jsx                  # ponto de entrada
    ├── App.jsx                   # componente raiz: estado do plano, navegação entre abas
    ├── auth/                     # tela de login/registro e o "gate" de autenticação
    ├── api/                      # cliente HTTP e chamadas à API do plano
    ├── views/                    # uma view por aba (dia, semana, edital, metas, concursos, progresso)
    ├── components/                # componentes pequenos reutilizados entre views
    ├── lib/                      # funções puras: datas, motor de rotação/ciclos, sequências
    ├── data/                     # forma dos dados e migração de versões antigas
    └── styles/                   # paleta de cores e estilos compartilhados
```

## Autenticação e banco de dados

Cada usuário tem seu próprio plano de estudos, protegido por login. A API local (`server/`) guarda:

- Contas de usuário (email + senha com hash).
- Um registro por usuário com todo o plano (concursos, matérias, metas, planos diários e histórico de atividade).

O banco (`server/data.sqlite`) e o segredo de sessão (`.env`) não são versionados — cada máquina tem os seus. Essa é uma etapa **local** intencionalmente: antes de hospedar a API em algum serviço externo (ex: Supabase), a ideia é validar o fluxo de login/dados rodando localmente.

Importante: o deploy no GitHub Pages publica só o front-end. Sem a API hospedada em algum lugar, a versão publicada não terá login funcional — isso é o próximo passo, não uma limitação do código atual.

## Licença

Este projeto ainda não possui uma licença definida.
