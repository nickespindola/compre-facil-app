# CompreFácil Microservices

Este projeto contém dois microsserviços independentes:
- **payment-service**: Gerencia pagamentos, armazena transações no Postgres e publica eventos no RabbitMQ.
- **notification-service**: Consome eventos do RabbitMQ e notifica usuários sobre pagamentos.

## Como executar

### 1. Suba os serviços de infraestrutura
```zsh
docker compose up -d
```

### 2. Crie a tabela de pagamentos no Postgres
Acesse o container do Postgres:
```zshe
docker exec -it <nome_do_container_postgres> psql -U payment_user -d payment_db
```
Execute o script:
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Instale as dependências
```zsh
cd payment-service && npm install
cd ../notification-service && npm install
```

### 4. Execute os microsserviços
Em terminais separados:
```zsh
cd payment-service && npm start
cd ../notification-service && npm start
```

## Fluxo
- O serviço de pagamento recebe uma solicitação via REST, armazena no banco e publica evento no RabbitMQ.
- O serviço de notificação consome o evento e notifica o usuário.
- Quando o pagamento é confirmado, novo evento é publicado e notificado.

## Observações
- Os serviços são independentes e se comunicam apenas via RabbitMQ.
- O banco de dados é utilizado apenas pelo serviço de pagamento.

## Contexto Acadêmico
- Instituição: UniSENAI
- Disciplina: Desenvolvimento de Sistemas Distribuídos

