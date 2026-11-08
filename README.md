# GridPOP

Um jogo de puzzle responsivo, feito com HTML, CSS e JavaScript sem dependências.

## Jogar

Abre `index.html` num navegador moderno. Escolhe uma peça e toca numa célula para a colocar, ou arrasta-a para o tabuleiro. O tabuleiro tem 10 × 10 células. O recorde fica guardado neste dispositivo.

Os efeitos sonoros e a música ambiente sintetizada começam ativos. A música tem agora um ritmo mais animado. Os respetivos botões permitem silenciar cada um separadamente. Se o navegador bloquear a reprodução automática, a música começa no primeiro toque ou tecla.

## Regras de pontuação

- Cada quadrado colocado vale 10 pontos.
- Cada linha ou coluna limpa vale 100 pontos.
- Limpar mais do que uma linha de uma vez dá 50 pontos extra por linha adicional.
- **Sequência** é o número de jogadas seguidas em que limpas pelo menos uma linha ou coluna. Uma jogada sem limpeza reinicia a contagem; cada jogada consecutiva depois da primeira dá 50 pontos extra.
- Cada contacto entre blocos da mesma cor dá 25 pontos.
- Completar o padrão de sorriso apresentado em “Como jogar” com os sete blocos da mesma cor limpa o rosto e dá 250 pontos.
- A bola monocromática tem filas centradas de 2, 4, 4 e 2 blocos; limpa os blocos adjacentes, preserva a bola e dá 500 pontos.
- A seta monocromática de 7 blocos funciona nas quatro direções ortogonais, salta blocos ocupados e coloca um bloco na próxima célula vazia do seu percurso; dá 150 pontos.

O jogo termina quando nenhuma das peças disponíveis cabe no tabuleiro.
