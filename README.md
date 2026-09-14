# SANDERVERSE UNITE

MOBA tático mobile **1v3** em HTML5 Canvas puro (Vanilla JS).  
Sander enfrenta Polo, Lupe e Topete numa arena de 2800×1600. Sem Phaser, React ou jQuery.

## Controles

| Input | Ação |
| --- | --- |
| D-pad analógico (esquerdo) / WASD / setas | Movimento vetorial |
| ATACAR / Espaço / J | Projétil elétrico |
| Q | Tornados Sada |
| W / R | Diamante (burst + breve invulnerabilidade) |
| E | Calopsita Resplandor (área) |
| ⚡ / F / Shift | Salto (dash) ou **depósito de aura** na Goal Zone roxa |

Colete orbes no chão. Cada orbe aumenta a velocidade em **+3%**.  
Entre na **Goal Zone** adversária (portal roxo) e use ⚡ para converter auras em pontos.

## Clímax

- Últimos **2 minutos** (`≤ 120s`): banner **FRENESÍ DE ENERGIA**, drops e pontuação ×2.
- Últimos **10 segundos**: contagem 3D + batimento cardíaco sintetizado (Web Audio API).

## Como jogar localmente

1. Coloque a pasta no computador (já vem com os 12 assets).
2. Sirva via HTTP — Canvas/imagens podem falhar em `file://` em alguns navegadores:

```bash
# Python
python3 -m http.server 8080

# ou Node
npx serve .
```

3. Abra `http://localhost:8080` no celular (mesma rede) ou no desktop.
4. Toque em **ENTRAR NA ARENA** para pedir tela cheia e orientação landscape.

## Deploy no GitHub Pages

1. Crie um repositório vazio, por exemplo `sanderverse-unite-mobile`.
2. Envie **o conteúdo da pasta** (não a pasta-pai) para a branch `main`:

```bash
git init
git add index.html style.css game.js README.md assets
git commit -m "SanderVerse Unite mobile v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sanderverse-unite-mobile.git
git push -u origin main
```

3. No GitHub: **Settings → Pages → Deploy from a branch → main / root**.
4. URL final: `https://SEU_USUARIO.github.io/sanderverse-unite-mobile/`

O viewport já bloqueia pinch-zoom e scroll:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

## Assets em `assets/`

| Arquivo | Uso no motor |
| --- | --- |
| `logo_banner.png` | Banner da tela inicial |
| `map_arena.png` | Cenário isométrico 2800×1600 |
| `sander.png` | Retrato / HUD de Sander |
| `sheet_sander.png` | Spritesheet 4×4 do protagonista |
| `calopsita_polo.png` | Polo Yin-Yang (corpo inteiro / fallback) |
| `sheet_sanderai.png` | Spritesheet 4×4 de Polo |
| `calopsita_lupe.png` | Lupe Celestial (corpo inteiro / fallback) |
| `sheet_lupe.png` | Spritesheet 4×4 de Lupe |
| `calopsita_topete.png` | Némesis / Topete (corpo inteiro / fallback) |
| `sheet_topete.png` | Spritesheet 4×4 de Topete |
| `aura_energy.png` | Orbe de calopsita flutuante |
| `mini_logo.png` | Emblema SanderVerse (drop alternativo) |

Se alguma imagem faltar, o motor desenha fallbacks vetoriais (círculos neon + lanes).

### Máquina de estados — `sheet_sander.png` (quadros 1–16)

| Estado | Quadros |
| --- | --- |
| IDLE | 1, 4, 16 |
| WALK/RUN | 2, 3, 5, 8 |
| ATTACK | 7 |
| CHANNEL | 6, 13 |
| DASH | 9, 10, 12 |
| FRENZY | 11 |

## Stack

- HTML5 Canvas + minimapa em canvas secundário
- CSS3 neon/cyberpunk (`#00f2fe`, `#ff0055`, `#ffd700`, `#05050b`)
- Web Audio API (tons + heartbeat duplo, sem MP3)
- Sistema de partículas com pool (~460) e blend aditivo
- Pointer Events no D-pad (toque e mouse)
- Fullscreen API + Screen Orientation API

## Partículas

| Evento | Efeito |
| --- | --- |
| Ataque básico | Faíscas ciano no cano + rastro do projétil |
| Q Tornados | Anel + leque de sparks |
| W Diamante | Burst de quadrados dourados + anel |
| E Resplandor | Explosão de estrelas |
| ⚡ Dash | Rastro dourado |
| Depósito na Goal Zone | Fonte de estrelas ouro/roxo |
| Coleta de orbe | Sparkle + fumaça contínua no chão |
| Acerto / morte | Sparks brancos e neon |
| Frenesí / 10s finais | Burst global + pulso vermelho no heartbeat |

## Licença de uso

Projeto da marca **SanderVerse**. Use no repositório do criador. Substitua ou refine sprites quando as artes restantes chegarem.
