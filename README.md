# Words on ZTR3AM — Leaderboard

Site estático oficial da leaderboard, publicado por GitHub Pages em `https://z3rgtv.github.io/woz/`.

- O login usa OAuth da Twitch ou Google/YouTube com clientes públicos.
- O token de sessão existe apenas no `sessionStorage` do navegador.
- O motor local publica `leaderboard.json` ao arrancar, no final de cada partida e quando deteta alterações de cargos.
- O documento público contém no máximo as cinco runs mais recentes e a melhor run de cada jogador.
- A autenticação confirma o perfil através dos identificadores oficiais das plataformas; não altera a visibilidade pública da classificação.
- Tokens GitHub nunca fazem parte deste repositório.
