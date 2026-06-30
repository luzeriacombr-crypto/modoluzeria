Adicionar uma saudação estilizada no topo da página Minhas Demandas, replicando o visual do badge "Dashboard" da página Dashboard.

### O que será feito

1. Editar `src/components/luzeria/MyTasks.tsx`.
2. Inserir, acima do título "Coisas para fazer", um badge com o texto:
   `Olá, {primeira letra maiúscula do nome}! 🤩`
3. O badge usará o mesmo estilo do badge "Dashboard" em `AdminDashboard.tsx`:
   - fundo verde translúcido (`rgba(200,212,78,0.15)`),
   - texto na cor principal `#C8D44E`,
   - formato arredondado (pill),
   - fonte em caixa alta, tracking amplo e tamanho reduzido.
4. Garantir que o nome do usuário tenha a primeira letra sempre maiúscula, mesmo que salvo em minúsculas no perfil.
5. Verificar no preview que a saudação aparece corretamente tanto no desktop quanto no mobile, sem quebrar o layout existente (incluindo o seletor "Ver como" para admins).

### Arquivos envolvidos

- `src/components/luzeria/MyTasks.tsx` (único arquivo alterado)

### Critério de aceite

- O usuário vê "Olá, Nome! 🤩" dentro de um badge verde arredondado logo acima de "Coisas para fazer" ao abrir "Minhas Demandas".