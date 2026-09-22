-- Existia um trigger (20260814050000 → 20260823170000 → 20260827140000)
-- que disparava a notificação em lote AUTOMATICAMENTE toda vez que uma ou
-- mais linhas eram inseridas em platform_updates, escolhendo a primeira
-- linha do INSERT como destaque. Isso significa que qualquer inserção em
-- lote (inclusive um script de backfill, como o que rodou hoje) já manda
-- notificação de verdade pra todo mundo, sem revisão nenhuma antes —
-- foi exatamente o que aconteceu: 17 novidades inseridas de uma vez
-- dispararam a notificação na hora, mas o painel novo (sendPlatformUpdateNotification
-- + notified_at) não sabia disso e continuava oferecendo pra mandar de novo.
--
-- Agora que existe um painel em Configurações → Atualizações pra escolher
-- o destaque e ver a prévia antes de mandar, o disparo automático vira
-- redundante e perigoso (risco de notificação duplicada). Desliga o
-- trigger — dali em diante, só o botão "Notificar todo mundo" manda.
DROP TRIGGER IF EXISTS trg_notify_platform_update ON public.platform_updates;
DROP FUNCTION IF EXISTS public.notify_platform_update();
