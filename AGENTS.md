This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Regras Obrigatórias — 12 Leis de UX em Toda Criação/Edição de UI

Ao criar ou modificar qualquer tela, fluxo, card, formulário ou diálogo neste projeto, garanta conformidade com todas as 12 Leis de UX:

1. **Lei de Jakob**: siga padrões esperados (`Ajustes`, ícones familiares), exija confirmação destrutiva (`confirmDestructiveAction`) antes de excluir dados e separe visualmente chips interativos de badges passivos.
2. **Lei de Hick**: evite excesso de escolhas por item (toque na linha para editar + menu único `⋮` para ações secundárias; sem botões duplicados na mesma tela).
3. **Lei de Fitts**: mantenha a ação principal grande e na zona natural do polegar (barra inferior fixa durante treino), controles com área de toque confortável (`>= 40×40 dp` / `hitSlop`) e botões sem corte de texto.
4. **Lei de Miller**: mantenha blocos curtos e escaneáveis (cards recolhíveis, acordeão com apenas o primeiro item expandido e opções avançadas colapsadas).
5. **Efeito Von Restorff**: destaque visualmente a ação principal (ex.: botão `Concluir` esmeralda) acima dos elementos secundários.
6. **Efeito Estética-Usabilidade**: preserve tema claro padrão, alinhamento limpo, números tabulares (`tabular-nums`), eixos inteiros para contagens e validação visual sem cortes.
7. **Lei da Proximidade**: mantenha controles relacionados no mesmo bloco (ex.: barra semanal unificada; filtros acima do conteúdo filtrado).
8. **Efeito de Posição Serial**: priorize no topo o conteúdo de uso imediato (compactando cabeçalhos durante treino ativo; backup local no topo) e no rodapé a ação de conclusão.
9. **Regra do Pico-Final**: encerre fluxos-chave com resumo de conquista e próximo passo claro (`WorkoutCompletedDialog`).
10. **Limite de Doherty**: evite travamentos e relayouts de listas (`FlashList`) usando dock/overlay absoluto para timers transitórios e feedback imediato ao toque.
11. **Lei de Tesler**: reduza esforço manual com placeholders do histórico anterior, preenchimento automático ao marcar `✓`, duplicação de treinos em 1 toque e limpeza automática do timer ao concluir.
12. **Efeito Zeigarnik**: mostre progresso da sessão, meta semanal e streak de consistência para incentivar conclusão contínua.
