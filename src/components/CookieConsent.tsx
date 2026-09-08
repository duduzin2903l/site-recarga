import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CookieChoice = "accepted" | "dismissed";

const COOKIE_CONSENT_KEY = "tim_cookie_consent";

const CookieConsent = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const savedChoice = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    setIsOpen(!savedChoice);
  }, []);

  const saveChoice = (choice: CookieChoice) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647,
        backgroundColor: "#ececef",
        opacity: 1,
      }}
    >
      <div className="mx-auto w-full max-w-[430px] px-8 pb-7 pt-10">
        <p className="text-[14px] font-bold leading-[1.45] text-black sm:text-[15px]">
          Nosso site armazena cookies para melhorar a sua navegacao.
        </p>
        <p className="mt-1 text-[14px] leading-[1.45] text-black sm:text-[15px]">
          Ao continuar, entendemos que voce esta de acordo com a{" "}
          <a
            href="https://www.tim.com.br/para-voce/atendimento/privacidade"
            target="_blank"
            rel="noreferrer"
            className="text-primary"
          >
            Politica de Privacidade da TIM
          </a>
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => saveChoice("dismissed")}
            className="h-[50px] min-w-[106px] rounded-[14px] border border-primary bg-[#ececef] px-6 text-[14px] font-medium text-primary"
            style={{ opacity: 1 }}
          >
            Dispensar
          </button>
          <button
            type="button"
            onClick={() => saveChoice("accepted")}
            className="h-[50px] min-w-[92px] rounded-[14px] border border-primary bg-primary px-6 text-[14px] font-medium text-white"
            style={{ opacity: 1 }}
          >
            Aceitar
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="ml-auto mt-8 block text-[14px] text-primary"
        >
          Alterar preferencias
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default CookieConsent;
