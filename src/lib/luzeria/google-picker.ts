/** Google Picker — a janela oficial do Google pra escolher arquivos/pastas do
 * Drive. Usada só nas agências com acesso limitado (`drive.file`): escolher
 * um item aqui é o que dá ao Modo Criador acesso àquele item específico
 * (por isso o `setAppId` com o número do projeto é obrigatório).
 * Pastas escolhidas dão acesso só à pasta — o app pode criar coisas dentro
 * dela, mas não enxerga o que já estava lá. */

const API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as string | undefined;
const PROJECT_NUMBER = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_NUMBER as string | undefined;

export type PickedDriveItem = { id: string; name: string; mimeType: string };

let loadPromise: Promise<void> | null = null;

function loadPickerScript(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    const w = window as any;
    const onGapi = () => w.gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Falha ao carregar o Google Picker.")) });
    if (w.gapi) { onGapi(); return; }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = onGapi;
    script.onerror = () => { loadPromise = null; reject(new Error("Falha ao carregar o Google Picker.")); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Abre o Picker e resolve com os itens escolhidos (lista vazia se a pessoa
 * fechar sem escolher). `kind: "folder"` mostra só pastas. */
export async function openDrivePicker(opts: {
  token: string;
  kind: "files" | "folder";
  multiple?: boolean;
  title?: string;
}): Promise<PickedDriveItem[]> {
  if (!API_KEY || !PROJECT_NUMBER) {
    throw new Error("A escolha de arquivos do Drive ainda não está disponível. Avise o suporte.");
  }
  await loadPickerScript();
  const google = (window as any).google;
  const picker = google.picker;

  return new Promise<PickedDriveItem[]>((resolve) => {
    const builder = new picker.PickerBuilder()
      .setDeveloperKey(API_KEY)
      .setAppId(PROJECT_NUMBER)
      .setOAuthToken(opts.token)
      .setLocale("pt-BR")
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((res: any) => {
        const action = res[picker.Response.ACTION];
        if (action === picker.Action.PICKED) {
          const docs = (res[picker.Response.DOCUMENTS] ?? []) as any[];
          resolve(docs.map((d) => ({
            id: d[picker.Document.ID],
            name: d[picker.Document.NAME],
            mimeType: d[picker.Document.MIME_TYPE],
          })));
        } else if (action === picker.Action.CANCEL) {
          resolve([]);
        }
      });

    if (opts.title) builder.setTitle(opts.title);

    if (opts.kind === "folder") {
      const mine = new picker.DocsView(picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes("application/vnd.google-apps.folder")
        .setParent("root");
      const shared = new picker.DocsView(picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes("application/vnd.google-apps.folder")
        .setEnableDrives(true);
      builder.addView(mine).addView(shared);
    } else {
      const mine = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setParent("root");
      const sharedWithMe = new picker.DocsView(picker.ViewId.DOCS).setOwnedByMe(false);
      const drives = new picker.DocsView(picker.ViewId.DOCS).setEnableDrives(true);
      const recent = new picker.DocsView(picker.ViewId.RECENTLY_PICKED);
      builder.addView(mine).addView(sharedWithMe).addView(drives).addView(recent);
      if (opts.multiple) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    }

    builder.build().setVisible(true);
  });
}
