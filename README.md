# Inscriere activitati copii Arad

Aplicatie statica pentru completarea cererii de inscriere la cercurile Palatului Copiilor Arad. Datele personale raman in browser; aplicatia genereaza local un PDF pe baza formularului oficial pentru anul scolar 2026-2027.

## Comenzi rapide

- `make install` instaleaza dependintele Node si Go.
- `make dev` porneste aplicatia Vite pentru dezvoltare.
- `make build-pages` construieste versiunea GitHub Pages in `docs/`.
- `make check` ruleaza lint, typecheck, teste frontend, teste Go si scanarea de secrete.
- `make smoke` construieste pagina statica si ruleaza testul Playwright.

## Docker

Imaginea production se construieste pentru amd64:

```sh
make docker-build-amd64
```

Serverul public din Docker Compose este expus prin nginx pe portul `26453`.

## Surse oficiale

- Inscrieri Arad: https://palatulcopiilorarad.ro/inscrieri-arad/
- Cercuri Arad: https://palatulcopiilorarad.ro/cercuri-arad/
- Relocare temporara: https://palatulcopiilorarad.ro/anunturi/comunicat-de-presa-relocarea-temporara-a-activitatilor-palatului-copiilor-arad/
- PDF cerere inscriere: https://palatulcopiilorarad.ro/wp-content/uploads/2026/05/cerere-inscriere-Arad-2026-2027.pdf
