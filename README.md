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
- Dados salvos localmente no navegador.
- Deploy preparado para GitHub Pages.

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

- React
- Vite
- Lucide React
- JavaScript/JSX
- CSS inline e estilos locais do componente
- `localStorage` como persistência padrão do navegador

O componente também é compatível com ambientes que disponibilizam `window.storage`; quando essa API não existe, o aplicativo usa automaticamente o armazenamento local do navegador.

## Como executar localmente

Pré-requisito: Node.js LTS.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente:

```text
http://localhost:5173/
```

## Scripts disponíveis

```bash
npm run dev      # inicia o servidor de desenvolvimento
npm run build    # gera a versão de produção em dist/
npm run preview  # serve a versão de produção localmente
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
├── .github/workflows/deploy.yml  # deploy automático no GitHub Pages
├── index.html                    # documento HTML principal
├── main.jsx                      # entrada do React
├── PlanoDeEstudos.jsx            # aplicação e componentes da interface
├── package.json                  # scripts e dependências
└── vite.config.js                # configuração do Vite
```

## Armazenamento dos dados

Os dados são mantidos no navegador utilizado para acessar a aplicação. Isso inclui:

- Concursos cadastrados.
- Matérias e assuntos.
- Metas de estudo.
- Planos diários.
- Histórico de atividade.

Limpar os dados do site ou trocar de navegador pode remover o plano salvo localmente. Faça uma exportação ou backup antes de limpar o armazenamento do navegador.

## Licença

Este projeto ainda não possui uma licença definida.
