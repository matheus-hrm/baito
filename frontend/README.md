# Baito Frontend

Aplicacao React/Vite do Baito. Em producao, o build estatico e servido por Nginx no Dockerfile desta pasta.

## Variaveis

```env
VITE_API_URL=http://localhost:3000
```

Essa URL e embutida no build do Vite e precisa ser acessivel pelo navegador do usuario.

## Desenvolvimento

```bash
npm install
npm run dev
```

Servidor local padrao:

```text
http://localhost:5173
```

## Build E Validacao

```bash
npm run build
npm run lint
```

## Docker

Para rodar frontend e backend juntos, use o Compose da raiz do repositorio:

```bash
docker compose up --build
```

O Dockerfile desta pasta aceita o argumento `VITE_API_URL`:

```bash
docker build --build-arg VITE_API_URL=http://localhost:3000 -t baito-frontend .
```
