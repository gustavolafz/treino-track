# Arquivo Histórico de Documentação

Este diretório consolida o contexto histórico de transição do template inicial do Expo até a arquitetura e documentação atuais do **TreinoTrack** (`v1.0.0`).

---

## 1. Limpeza do template inicial do Expo

No commit inicial (`c91d958`), o repositório continha telas e utilitários de exemplo gerados pelo template padrão do Expo Router. Esses arquivos foram substituídos pela arquitetura definitiva do aplicativo no commit `8cb58cd`:

| Artefato removido / substituído | Substituição atual no projeto |
| --- | --- |
| `app/(tabs)/two.tsx`, `app/modal.tsx` | Abas [rotina.tsx](../../app/%28tabs%29/rotina.tsx), [evolucao.tsx](../../app/%28tabs%29/evolucao.tsx) e [config.tsx](../../app/%28tabs%29/config.tsx) + componente [Dialog](../../components/ui/dialog.tsx) |
| `components/Themed.tsx`, `StyledText.tsx`, `EditScreenInfo.tsx`, `ExternalLink.tsx` | Primitivos estilizados no padrão shadcn/ui em [components/ui/](../../components/ui/index.ts) + NativeWind (`global.css`) |
| `components/useColorScheme*.ts`, `useClientOnlyValue*.ts` | Controle centralizado de tema em [AppContext.tsx](../../store/AppContext.tsx) (`themePreference`) |

---

## 2. Histórico da evolução de UI antes da consolidação em `docs/images/`

Durante a validação em dispositivo físico (`moto g35 5G`, `1080×2400`), duas iterações de build precederam a seleção atual de capturas:

1. **Iteração inicial (v1):** identificou corte da barra de abas pela navegação por gestos do Android, desalinhamento vertical nos inputs de carga/reps, abreviação de 4 caracteres na tira semanal e colisão de rótulos na borda direita do gráfico.
2. **Iteração intermediária (v2):** validou a correção da barra inferior, da rotina PPLUL exata e dos inputs, revelando os 4 últimos pontos visuais ajustados na build final (`v3` → promovida para [docs/images/](../images/)):
   - Truncamento do chip `Viagem / Compromisso` no diálogo de Skip em Fabric Android.
   - Quebra em 2 linhas no botão `+ Adicionar Exercício` na aba `Treinos (5)`.
   - Truncamento de rótulos (`slice(0, 5)`) no eixo X de `Consistência` (`19 ou` → `19 out`).
   - Quebra irregular de chips recentes abaixo do gráfico de linha (corrigida com `ScrollView horizontal`).

As 4 capturas finais pós-correção estão armazenadas em [docs/images/](../images/).
