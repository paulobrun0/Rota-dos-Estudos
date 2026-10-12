# Ritmo · Marcações de estudo

Extensão independente para Chrome e Edge. Guarda trechos, notas e cores localmente, restaura grifos, revisa notas, oferece Pomodoro persistente e modo foco reversível, e exporta JSON ou Markdown. As marcações permanecem locais até a exportação. O montador compartilha com sua plataforma apenas o pedido, a correspondência do assunto e o link do caderno, sem coletar credenciais ou conteúdo de questões.

Extraia o pacote e carregue a pasta em `chrome://extensions`, usando **Carregar sem compactação**. Capture uma seleção na página ativa e guarde-a. Use **Mostrar grifos nesta página** para restaurar os trechos. Trechos repetidos são ignorados para evitar grifar a ocorrência errada; conteúdo dinâmico pode exigir nova restauração.

No TEC, a restauração automática exige clicar em **Restaurar automaticamente neste site** e autorizar o acesso opcional ao TEC. Nos demais sites, use a restauração manual pela aba ativa. Para revogar, use **Desativar restauração neste site**. O modo foco oculta menus e alguns anúncios; clique novamente para restaurá-los. Páginas protegidas e internas podem impedir acesso.

Para PDF, o botão abre o leitor da própria plataforma. Abra seu arquivo local para grifar e exportar uma cópia anotada. PDFs de imagens precisam de OCR externo; arquivos protegidos precisam ser desbloqueados pelo proprietário.

Em **Ferramentas**, importe o JSON exportado e escolha o assunto. Faça uma exportação antes de remover a extensão ou trocar de navegador. O Pomodoro persiste o prazo mesmo com o popup fechado, mas não envia notificações nem registra estudo automaticamente.

## Montador TEC (1.2)

Depois de instalar ou atualizar a extensão, clique em **Ativar montador TEC** no popup, autorize `https://www.tecconcursos.com.br/*` e recarregue `https://app.paulobruno.dev`. Na plataforma, **Gerar caderno TEC** abre a configuração por assunto. A extensão abre o filtro na sua conta do TEC, seleciona assunto/banca/anos/opções, aguarda a contagem, ajusta a quantidade e gera o caderno.

Confirme a correspondência quando houver dúvida e a pasta na primeira montagem. A correspondência fica guardada no assunto; a pasta é lembrada pela plataforma. Se a criação já foi iniciada, a extensão não a repete automaticamente após recarregar. O resultado é mantido localmente para voltar à conta de origem quando a plataforma for reaberta. **Vincular caderno aberto** recupera o link de uma montagem já iniciada; **Vincular link gerado** na plataforma permite recuperação manual. **Desativar montador TEC** interrompe as montagens pendentes e remove a autorização do TEC, preservando cadernos já criados.

A ponte da plataforma roda apenas no domínio `app.paulobruno.dev`. Os scripts do TEC são registrados somente depois de sua autorização. O montador usa o DOM visível, sem cookies, senhas, tokens, API interna ou coleta de enunciados. Mudanças nos controles do TEC podem exigir uma atualização da extensão. Não é um produto oficial do TEC.

Para recriar o pacote neste repositório: `python scripts/package-extension.py`. O protocolo da extensão é copiado de `src/lib/tecProtocol.js`, também usado pelo servidor para validar pedidos e backups.

A única permissão permanente opcional é para o domínio do TEC. Nos demais sites, a captura e a restauração manual usam o acesso à aba ativa após clicar no popup. A restauração automática de grifos está limitada ao TEC.
