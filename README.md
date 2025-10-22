# Sunvolt - Site Survey Application

Sistema profissional de levantamento para instalações solares otimizado para iPad.

## 🎯 Melhorias Implementadas

### ✅ Correções Críticas

1. **Bug de geração de PDF corrigido** ⚡
   - Removidas promises assíncronas que travavam
   - Carregamento de imagens simplificado e otimizado
   - PDF agora gera instantaneamente sem travar
   - Melhor tratamento de erros

### ✅ Correções Solicitadas

2. **Imagens sem distorção no PDF**
   - Implementado cálculo de aspect ratio correto
   - Imagens mantêm proporções originais
   - Centralização automática de fotos no PDF

3. **Removido "Republic of Ireland"**
   - Removido da primeira página do PDF
   - Layout mais limpo e profissional

4. **Logo Sunvolt + Cabeçalho Site Survey**
   - Logo da Sunvolt adicionado ao topo do aplicativo
   - Cabeçalho com branding profissional
   - Logo também aparece na capa do PDF

5. **Títulos sem caracteres especiais**
   - Removidos emojis dos títulos das seções do PDF
   - Texto limpo e profissional
   - Mantidos emojis na interface web para melhor UX

### 🚀 Melhorias Adicionais

6. **Otimizado para iPad** 📱
   - Cores de alto contraste para uso externo (luz do sol)
   - Fontes e botões maiores (17-18px)
   - Touch targets otimizados (48-52px)
   - Bordas mais espessas (2-3px) para melhor visibilidade
   - Sombras e efeitos visuais aprimorados

5. **Código Organizado**
   - Separado em 3 arquivos: `index.html`, `styles.css`, `app.js`
   - Código limpo e bem comentado
   - Fácil manutenção e customização

6. **Design Profissional**
   - Cores corporativas Sunvolt (laranja/âmbar)
   - Layout responsivo melhorado
   - Transições suaves e animações

7. **Geração de PDF Profissional**
   - Capa com logo e informações destacadas
   - Seções bem organizadas
   - Fotos com qualidade preservada
   - Rodapé com informações de rastreamento

8. **Indicadores Visuais**
   - Círculos coloridos para status (verde/vermelho)
   - Percentual de cobertura do telhado
   - Alertas visuais para dados incompletos

## 📁 Estrutura de Arquivos

```
/SURVEYVERSAOFINAL/
├── index.html       # Estrutura HTML
├── styles.css       # Estilos e tema
├── app.js          # Lógica JavaScript
└── README.md       # Documentação
```

## 🎨 Personalização da Logo

Para substituir a logo placeholder pela logo real da Sunvolt:

### Opção 1: Logo SVG (Recomendado)
1. Converta sua logo para Base64
2. No arquivo `app.js`, localize a linha 21:
```javascript
const SUNVOLT_LOGO = 'data:image/svg+xml;base64,...';
```
3. Substitua pelo Base64 da sua logo

### Opção 2: Logo PNG/JPG
1. Converta a imagem para Base64 em: https://base64.guru/converter/encode/image
2. Substitua o valor da constante `SUNVOLT_LOGO`
3. Ajuste o formato:
```javascript
const SUNVOLT_LOGO = 'data:image/png;base64,iVBORw0KGgo...';
```

## 🔧 Configuração Google Drive (Opcional)

Para habilitar sincronização com Google Drive:

1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto
3. Ative a API do Google Drive
4. Crie credenciais OAuth 2.0
5. No arquivo `app.js` (linhas 10-11), substitua:
```javascript
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID_AQUI';
const GOOGLE_API_KEY = 'SUA_API_KEY_AQUI';
```

## 📋 Funcionalidades

### Interface Web
- ✅ Formulário multi-etapas (6 seções)
- ✅ **NOVO: Salvar/Carregar progresso (JSON)** - Salve a qualquer momento e continue depois!
- ✅ Upload e compressão automática de fotos
- ✅ Desenho em canvas para sketches
- ✅ Cálculo automático de painéis
- ✅ Modo escuro/claro
- ✅ Auto-save a cada 30 segundos
- ✅ Histórico de levantamentos
- ✅ Busca no histórico

### Geração de PDF
- ✅ Capa profissional com logo
- ✅ Sumário executivo
- ✅ Verificações do sistema
- ✅ Avaliação de telhados
- ✅ Preferências do cliente
- ✅ Fotos sem distorção
- ✅ Numeração de páginas
- ✅ Rodapé com ID de rastreamento

### Exportação
- 📄 PDF profissional
- 💾 JSON com todos os dados
- ☁️ Google Drive (opcional)
- 🔗 Compartilhamento via sistema nativo

## 📱 Otimizações para iPad

### Uso Externo (Luz Solar)
- **Cores de alto contraste**: Laranja vibrante (#FF6B00) visível sob sol
- **Bordas grossas**: 2-3px para melhor definição
- **Botões grandes**: 48-52px touch targets
- **Texto grande**: 17-18px base
- **Sombras fortes**: Maior profundidade visual

### Uso Interno (Ambiente Controlado)
- **Modo escuro**: Reduz fadiga visual
- **Cores neon**: Verde (#00E676), Vermelho (#FF5252)
- **Contraste suave**: Background #121212

### Recursos iPad
- ✅ Touch otimizado (sem hover requirements)
- ✅ Gestos nativos (pinch, swipe)
- ✅ Câmera integrada para fotos
- ✅ Canvas para desenhos com Apple Pencil
- ✅ Teclado on-screen otimizado
- ✅ Orientação landscape/portrait

## 🎯 Uso

### Uso Básico
1. Abra `index.html` no navegador (Safari no iPad recomendado)
2. Preencha as 6 seções do formulário
3. Na última seção, clique em "PDF Report"
4. O PDF será gerado instantaneamente e baixado automaticamente

### 💾 NOVO: Salvar e Continuar Depois

#### Salvar Progresso (a qualquer momento)
1. **Durante o survey**, clique no ícone **💾** no cabeçalho
2. Um arquivo JSON será baixado: `Sunvolt_Progress_ClienteName_2024-10-22.json`
3. Guarde este arquivo em local seguro
4. Continue trabalhando ou feche o aplicativo

#### Carregar Progresso Salvo
1. Abra o aplicativo novamente
2. Clique no ícone **📂** no cabeçalho
3. Selecione o arquivo JSON salvo anteriormente
4. **Todos os dados serão restaurados**:
   - ✅ Informações básicas (nome, eircode, data)
   - ✅ Todas as verificações do sistema
   - ✅ Todos os telhados (dimensões, painéis, orientação)
   - ✅ Todas as fotos (system checks, roofs, additional)
   - ✅ Preferências do cliente
   - ✅ Notas e observações
5. Continue de onde parou!

#### Casos de Uso
- 📱 **Levantamento em etapas**: Faça parte hoje, resto amanhã
- 🔋 **Bateria acabando**: Salve progresso antes de desligar iPad
- 🔄 **Backup de segurança**: Salve antes de mudanças importantes
- 📤 **Compartilhar com equipe**: Envie JSON para colega continuar
- 💻 **Mudar de dispositivo**: Salve no iPad, abra no computador

## 🔄 Cálculo de Painéis

O sistema usa um algoritmo inteligente que testa múltiplas estratégias:
- **Portrait**: Painéis na vertical
- **Landscape**: Painéis na horizontal
- **Mixed**: Combinação otimizada
- **Split Zone**: Divisão do telhado em áreas

**Nota importante**: O cálculo é apenas uma estimativa. A instalação real deve considerar:
- Obstruções (chaminés, claraboias, ventilação)
- Estrutura do telhado
- Limitações técnicas
- Regulamentações locais

## 📸 Fotos

- Máximo: 20 fotos por levantamento
- Compressão automática para 1200px
- Qualidade: 80% (balanceado)
- Formatos: JPG, PNG, HEIC

## 💡 Dicas de Uso

1. **Fotos de Qualidade**: Tire fotos bem iluminadas e focadas
2. **Medidas Precisas**: Use medições exatas para cálculos corretos
3. **Notas Detalhadas**: Documente observações importantes
4. **Sketches**: Use o canvas para marcar obstruções e detalhes
5. **Revisão**: Sempre revise na última seção antes de gerar PDF

## 🐛 Resolução de Problemas

### PDF não gera
- Verifique se preencheu os campos obrigatórios (Eircode, Nome, Data)
- Aguarde alguns segundos durante a geração
- Verifique o console do navegador (F12) para erros

### Fotos distorcidas
- Versão atual corrige automaticamente o aspect ratio
- Se ainda houver problemas, reporte com exemplo da foto

### Logo não aparece
- Verifique se o Base64 está correto
- Confirme que o formato está especificado (svg/png/jpg)

## 📱 Compatibilidade

- ✅ Chrome/Edge (Recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile (iOS/Android)
- ✅ Tablets

## 🔐 Privacidade

- Todos os dados são armazenados localmente (localStorage)
- Nenhum dado é enviado para servidores externos
- Google Drive é opcional e requer autorização do usuário

## 📄 Licença

© 2024 Sunvolt - Todos os direitos reservados

## 🤝 Suporte

Para suporte técnico ou dúvidas, entre em contato com a equipe Sunvolt.

---

**Versão**: 4.0
**Última Atualização**: 2024
**Desenvolvido por**: Claude Code para Sunvolt
