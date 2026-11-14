# TreinoTrack

Aplicativo de acompanhamento de treinos em **React Native (Expo)** com visual inspirado no **shadcn/ui** (temas claro e escuro).

## Funcionalidades

- **Treino diário (`Treino`)**: tira semanal (Seg–Dom), registro de carga (kg) e repetições por série, meta de séries/reps, cronômetro de descanso integrado (`120s` / `180s`), troca rápida de treino no dia e **Pular dia (Skip)**.
- **Skip com rotatividade (`+1 dia`)**: além do skip simples (grade fixa), permite pular o dia deslocando os treinos seguintes `+1 dia` na semana (com prévia antes de confirmar e reversão automática ao desfazer o skip).
- **Rotina e Divisões (`Rotina`)**: edição da grade semanal, rotação manual `±1 dia`, gerenciamento de treinos, exercícios, metas e descanso, além do histórico/alternância entre divisões (`PPLUL`, `PPLx2`, `Full Body` ou novas divisões).
- **Evolução (`Evolução`)**: gráficos interativos de carga máxima, 1RM estimado, total de repetições, peso corporal, percentual de gordura (`BF%`), massa magra e consistência semanal (`7D`, `30D`, `90D`, `Tudo`).
- **Backup (`Backup`)**: exportação/importação em arquivo `.json` e sincronização opcional com Google Drive (via OAuth Client ID próprio com escopo `drive.file`).

## Divisão padrão configurada (`PPLUL`)

- **Segunda — Pull**: 5 exercícios · 9 séries (`120s`)
- **Terça — Push**: 6 exercícios · 12 séries (`120s`)
- **Quarta — Legs**: 4 exercícios · 8 séries (`120s`, `180s` no Agachamento Pêndulo)
- **Sexta — Upper**: 6 exercícios · 12 séries (`120s`)
- **Sábado — Lower**: 5 exercícios · 10 séries (`120s`, `180s` no Stiff e Leg Press 45)
- **Total semanal**: 26 exercícios · 51 séries

## Desenvolvimento

```bash
npm install
npx expo start
```

Para gerar o APK Android de release após o prebuild:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```
