# Z3RG Stream Games — Leaderboards

Site estático oficial da leaderboard, publicado por GitHub Pages em `https://z3rgtv.github.io/woz/`.

- Existe uma secção por jogo no mesmo endereço. O seletor é criado automaticamente a partir dos jogos presentes em `leaderboard.json`, permitindo acrescentar jogos futuros sem criar outro site.

- O login usa OAuth da Twitch ou Google/YouTube com clientes públicos.
- O token de sessão existe apenas no `sessionStorage` do navegador.
- O motor local publica `leaderboard.json` ao arrancar, no final de cada partida e quando deteta alterações de cargos.
- O documento público contém no máximo as cinco runs mais recentes e a melhor run de cada jogador.
- A autenticação confirma o perfil através dos identificadores oficiais das plataformas; não altera a visibilidade pública da classificação.
- Tokens GitHub nunca fazem parte deste repositório.

Os ficheiros visuais são publicados com `npm run site:publish`. Para atualizar apenas os dados públicos sem iniciar o jogo, usar `npm run leaderboard:publish`.
