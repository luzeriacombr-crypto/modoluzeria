import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriveAccessMode, getDrivePickerToken } from "./drive.functions";
import { openDrivePicker, type PickedDriveItem } from "./google-picker";

/** Modo de acesso ao Drive da agência + atalho pra abrir o Picker.
 * `isLimited` = conexão nova com `drive.file`: nesses casos a UI troca
 * "Colar link do Drive" por "Escolher do Drive". Conexões antigas
 * (acesso completo) continuam exatamente como sempre foram. */
export function useDrivePicker() {
  const getMode = useServerFn(getDriveAccessMode);
  const getToken = useServerFn(getDrivePickerToken);
  const { data } = useQuery({
    queryKey: ["drive-access-mode"],
    queryFn: () => getMode(),
    staleTime: 1000 * 60 * 10,
  });
  const [opening, setOpening] = useState(false);

  async function pick(opts: { kind: "files" | "folder"; multiple?: boolean; title?: string }): Promise<PickedDriveItem[]> {
    setOpening(true);
    try {
      const { token } = await getToken();
      return await openDrivePicker({ token, ...opts });
    } finally {
      setOpening(false);
    }
  }

  return { mode: data?.mode ?? null, isLimited: data?.mode === "limited", pick, opening };
}
