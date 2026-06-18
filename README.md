# Baito

Marketplace de servicos com frontend React/Vite e backend Express/SQLite.

## Rodar Com Docker Compose

Crie um `.env` na raiz a partir do exemplo, se quiser trocar portas ou secrets:

```bash
cp .env.example .env
```

Suba frontend e backend:

```bash
docker compose up --build
```

URLs locais:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/health`

O banco SQLite fica no volume Docker `sqlite_data` e e montado no container da API em `/app/data/baito.db`.

## Configuracao

Variaveis principais da raiz:

```env
API_PORT=3000
FRONTEND_PORT=5173
FRONTEND_API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

`FRONTEND_API_URL` e usado no build do Vite. Como o codigo roda no navegador, esse valor precisa ser uma URL acessivel pelo browser, nao o nome interno do servico Docker.

Secrets principais:

```env
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ADMIN_EMAIL=admin@baito.local
ADMIN_PASSWORD_DERIVE_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` sao necessarias para o fluxo de pagamentos. Sem `STRIPE_SECRET_KEY` a API sobe, mas os endpoints de pagamento retornam erro 500. Veja a secao [Pagamentos (Stripe)](#pagamentos-stripe).

Para imprimir a senha admin derivada localmente:

```bash
cd backend
npm run admin:password
```

## Rodar Sem Docker

Backend:

```bash
cd backend
npm install
npm run db:migrate
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Comandos De Validacao

Backend:

```bash
cd backend
npm run build
npm run test:db
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

## Pagamentos (Stripe)

O pagamento de um contrato usa o **Stripe Checkout** (modo hospedado). Fluxo:

1. As partes negociam ate o contrato ficar com status `confirmed` e um `agreed_price` definido.
2. O cliente clica em pagar; o frontend chama `POST /api/payments/payment-intent`.
3. A API cria uma Checkout Session no Stripe e devolve a `url` de pagamento; o navegador e redirecionado para o Stripe.
4. Apos pagar, o Stripe redireciona de volta para `/contratos/:id?payment=success` (ou `?payment=cancelled`).
5. O Stripe envia o evento para `POST /api/payments/webhook`, que atualiza o status do pagamento no banco.

### Variaveis de ambiente

```env
STRIPE_SECRET_KEY=sk_test_...     # chave secreta da conta (use a de teste)
STRIPE_WEBHOOK_SECRET=whsec_...   # segredo de assinatura do webhook
```

Pegue as chaves no painel do Stripe em **Developers > API keys**. Use sempre as chaves de **teste** (`sk_test_...`) em desenvolvimento.

### Endpoints

| Metodo | Rota | Auth | Descricao |
| --- | --- | --- | --- |
| POST | `/api/payments/payment-intent` | Bearer (cliente ou prestador do contrato) | Cria/recupera a Checkout Session e retorna `{ data: { url } }`. Exige contrato `confirmed` com valor > 0. |
| POST | `/api/payments/webhook` | Assinatura Stripe | Recebe eventos. Trata `checkout.session.completed` (status `succeeded`) e `checkout.session.expired` (status `failed`). |

Exemplo de requisicao:

```bash
curl -X POST http://localhost:3000/api/payments/payment-intent \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "contractId": "<ID_DO_CONTRATO>" }'
# => { "data": { "url": "https://checkout.stripe.com/c/pay/cs_test_..." } }
```

### Testar o webhook localmente

O webhook precisa de uma assinatura valida; use a [Stripe CLI](https://docs.stripe.com/stripe-cli) para encaminhar os eventos:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/payments/webhook
```

O `stripe listen` imprime um `whsec_...` — copie para `STRIPE_WEBHOOK_SECRET` e reinicie o backend.

Cartao de teste para o Checkout: `4242 4242 4242 4242`, qualquer data futura e qualquer CVC.

## Estrutura

- `docker-compose.yml`: orquestra API, frontend e volume SQLite.
- `.env.example`: exemplo centralizado para o compose da raiz.
- `backend/`: API Express, migrations SQLite, auth, admin e regras de negocio.
- `frontend/`: aplicacao React/Vite servida em producao por Nginx.
