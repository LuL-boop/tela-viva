# Tela Viva

Editor de sites e apps com IA. Você descreve o que quer, a IA monta a página, e depois você edita cada elemento como no Canva (arrastar, redimensionar, camadas) ou refaz só um elemento com um prompt.

## O que tem aqui

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro (editor, canvas, exportação). Não precisa de build. |
| `api/ai.js` | Backend da IA. Guarda a chave da Anthropic e repassa as chamadas em streaming. |
| `server.js` | Servidor para rodar localmente ou em hospedagens Node. |
| `vercel.json` | Dá até 5 minutos para cada geração de site na Vercel. |

## Publicar na Vercel (recomendado)

1. Crie um repositório no GitHub e suba estes arquivos.
2. Em [vercel.com](https://vercel.com), clique em **Add New → Project** e importe o repositório. Não precisa mudar nenhuma configuração de build.
3. Em **Settings → Environment Variables**, cadastre:
   - `ANTHROPIC_API_KEY`: sua chave, criada em <https://console.anthropic.com/settings/keys>.
   - `ACCESS_CODE`: uma senha à sua escolha. Sem ela, qualquer pessoa com o link gasta o seu crédito.
4. Faça o deploy. A Vercel gera uma URL como `tela-viva.vercel.app`.

Na primeira vez que alguém usar a IA, o app pede o código de acesso e lembra dele naquele navegador.

## Rodar no seu computador

Precisa do Node 18 ou mais novo.

```bash
cp .env.example .env     # preencha ANTHROPIC_API_KEY (e ACCESS_CODE, se quiser)
npm start                # abre em http://localhost:3000
```

## Outras hospedagens

- **Render, Railway, Fly.io ou um servidor próprio:** use `npm start` como comando de execução e cadastre as mesmas variáveis de ambiente.
- **GitHub Pages ou Netlify só com arquivos estáticos:** o editor funciona, mas a IA não, porque falta o backend. Use a Vercel para o app e deixe o GitHub só como repositório.

## Variáveis de ambiente

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | | Chave da API. Obrigatória. |
| `ACCESS_CODE` | vazio | Código que o usuário digita para usar a IA. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Modelo usado. Troque por um mais capaz se quiser sites mais elaborados. |
| `MAX_TOKENS` | `16000` | Tamanho máximo da resposta. |
| `RATE_LIMIT_PER_HOUR` | `40` | Chamadas de IA por hora por IP. |

## Custo e segurança

- Cada geração de site, edição de elemento ou adaptação para celular é uma chamada paga na sua conta da API. Gerar um site inteiro usa bem mais que editar um elemento.
- A chave nunca vai para o navegador. Só `api/ai.js` a lê.
- O limite por hora é em memória. Na Vercel ele reinicia quando a função "dorme", então serve como freio, não como garantia. O `ACCESS_CODE` é a proteção principal.
- Os widgets gerados pela IA rodam em um iframe isolado (`sandbox="allow-scripts"`), sem acesso à página do editor.

## Onde ficam os projetos

O editor salva automaticamente no navegador (`localStorage`). Para guardar ou mover um projeto, use **Exportar → Salvar projeto (.json)**. Para publicar o site criado, use **Exportar → Baixar site (.html)** e suba o arquivo em qualquer hospedagem estática.
