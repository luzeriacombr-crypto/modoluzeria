-- O texto original das 23 etapas era mais "descrição de processo" do que
-- mensagem de chat de verdade. O Junior reescreveu tudo num tom mais
-- natural e humano — atualiza a descrição (que dobra como mensagem
-- sugerida no WhatsApp) em TODAS as agências, casando por (track, name).

UPDATE public.client_journey_stages cjs
SET description = v.description
FROM (VALUES
  ('onboarding', 'Contrato e início do projeto', 'Fechouuu! 🤝 Seu projeto já está oficialmente com a gente. A equipe já foi alinhada por aqui e agora começamos a organizar tudo para dar início aos trabalhos.'),
  ('onboarding', 'Onboarding e coleta de informações', 'Agora queremos mergulhar um pouquinho mais no seu negócio. 👀 Estamos olhando tudo que você compartilhou com a gente e entendendo melhor sua marca, seus objetivos e onde queremos chegar juntos.'),
  ('onboarding', 'Organização dos materiais', 'Bastidores funcionando por aquiii! 📂 Estamos separando fotos, vídeos, identidade visual, acessos e tudo que vamos precisar durante a produção. Se faltar alguma coisinha, a gente chama você.'),
  ('onboarding', 'Planejamento estratégico/Sistema de conteúdo', 'Agora entramos naquela parte de pensar antes de sair postando qualquer coisa. 🧠 Estamos cruzando tudo que você contou pra gente e definindo os caminhos que vamos seguir na comunicação e nos conteúdos.'),
  ('onboarding', 'Entrega do planejamento do primeiro mês', 'Temos um plano! 📝 Os conteúdos do seu primeiro mês já foram pensados e organizados. Definimos o que vamos falar, quais assuntos entram primeiro e como vamos distribuir tudo ao longo do mês.'),
  ('onboarding', 'Criação dos roteiros / Copys de Posts', 'As ideias já estão virando conteúdo! ✍️ Agora estamos escrevendo os roteiros, pensando nos ganchos dos vídeos e preparando os textos dos posts e carrosséis.'),
  ('onboarding', 'Gravação de conteúdo', 'Câmeras prontaaas! 🎥 Chegou o dia de tirar tudo do papel e gravar. Já estamos com os roteiros organizados para aproveitar bem nosso tempo e sair daqui com bastante material bom.'),
  ('onboarding', 'Edição dos conteúdos', 'Gravamosss! 💻 Agora os vídeos seguem para edição e, ao mesmo tempo, nosso time começa a trabalhar nas artes e carrosséis. Aos poucos, tudo que planejamos começa a ganhar cara.'),
  ('onboarding', 'Revisão interna', 'Boaaa!!! 🔎 O material já passou pela produção. Agora estamos naquela conferida geral antes de mandar pra você. Texto, vídeo, arte, informação... estamos olhando tudinho.'),
  ('onboarding', 'Aprovação do cliente', 'Chegou sua vez! 👀 Os conteúdos já estão disponíveis para você conferir. Dá uma olhada com calma e, se tiver algum ponto que queira ajustar, manda pra gente.'),
  ('onboarding', 'Programação das publicações', 'Aprovado? Então deixa com a genteee! 🗓️ Estamos colocando cada conteúdo no seu lugar e organizando as publicações conforme o calendário que planejamos.'),
  ('onboarding', 'Início das publicações', 'Estamos no aaar! 🚀 Depois de todo esse processo, os primeiros conteúdos começaram a sair. Agora é acompanhar de perto como o público vai responder.'),
  ('onboarding', 'Acompanhamento inicial', 'Agora ficamos de olho nos números. 📊 Vamos observar como o público está reagindo, quais conteúdos estão chamando mais atenção e o que já podemos aprender para o próximo mês.'),
  ('operational', 'Análise do mês anterior', 'Começando mais um mês dando aquela olhada no retrovisor. 🔎 Estamos vendo o que foi bem, o que chamou atenção do público e o que não respondeu tão bem quanto esperávamos. Tudo isso entra na conta do próximo planejamento.'),
  ('operational', 'Planejamento do próximo ciclo', 'Bora pensar no próximo mês? 🧠 Já estamos escolhendo os assuntos que fazem mais sentido agora e organizando as próximas ideias de conteúdo.'),
  ('operational', 'Criação dos roteiros', 'Planejamento aprovado. Boraaa colocar a mão na massa! ✍️ Os roteiros já estão sendo escritos e estamos preparando tudo para chegar na gravação sabendo exatamente o que precisamos produzir.'),
  ('operational', 'Gravação de conteúdo', 'Dia de gravaçãooo! 🎥 Roteiros na mão, câmera pronta e bora produzir os conteúdos das próximas semanas.'),
  ('operational', 'Produção dos conteúdos', 'Agora é com o nosso time! 💻 O material gravado já está sendo editado e as artes do mês também estão saindo do papel. Daqui a pouco tudo começa a chegar até você.'),
  ('operational', 'Revisão interna', 'Boaaa, produção finalizada! 🔎 Antes de mandar pra você, estamos passando conteúdo por conteúdo para conferir se está tudo certinho.'),
  ('operational', 'Aprovação do cliente', 'Sua vez! 👀 Os conteúdos já estão com você para aprovação. Encontrou algo que precisa mudar? Sinaliza pra gente que fazemos os ajustes por aqui.'),
  ('operational', 'Programação das publicações', 'Aprovado? Deixa com a genteee! 🗓️ Agora estamos organizando tudo no calendário e deixando os conteúdos preparados para entrarem no ar nas datas certas.'),
  ('operational', 'Publicação e acompanhamento', 'Conteúdo na rua! 🚀 Enquanto as publicações vão acontecendo, a gente continua por aqui acompanhando o que está funcionando e guardando esses aprendizados para o próximo planejamento.'),
  ('operational', 'Recomeço do ciclo', 'Fechamos mais uma rodadaaa! 🔄 E tudo que aprendemos neste mês já começa a alimentar as decisões do próximo. Agora o ciclo começa novamente, só que com mais informação na mão.')
) AS v(track, name, description)
WHERE cjs.track = v.track AND cjs.name = v.name;
