Atualizar a pasta raiz do Drive em `app_settings` (`drive_root_folder_id`) para o novo ID `1ViNGy0inXNdSK7SoLtyihlxalTAZ-K8s` (a pasta correta dentro do Drive da Luzeria).

Passos:
1. `UPDATE public.app_settings SET value = jsonb_set(value, '{id}', '"1ViNGy0inXNdSK7SoLtyihlxalTAZ-K8s"') WHERE key = 'drive_root_folder_id'` (via insert tool, mantendo o nome existente).
2. Sem alterações de código — `DriveSettingsTab` já lê esse valor.

Observação: pastas de clientes já mapeadas em `client_drive_map` continuam apontando para a localização antiga; novos clientes/uploads usarão a nova raiz. Se quiser, posso em seguida migrar/reorganizar os clientes existentes para dentro da nova pasta — me avise.