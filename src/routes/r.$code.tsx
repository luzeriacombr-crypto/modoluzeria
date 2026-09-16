import { createFileRoute, redirect } from "@tanstack/react-router";

// Link curto de indicação (modocriador.com.br/r/<code>) — só redireciona
// pro cadastro carregando o código; publicSignup/completeGoogleSignup
// tratam código inválido/expirado silenciosamente (cadastro normal, sem
// bônus), então não precisa validar nada aqui.
export const Route = createFileRoute("/r/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/assinar", search: { refCode: params.code } });
  },
});
