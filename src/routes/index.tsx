import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Clock, CreditCard, Wifi, Star, Gift } from "lucide-react";
import { fadeUp } from "@/lib/animations";
import timWoman from "@/assets/tim-woman-blue.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recarga TIM — Recarregue seu celular online" },
      { name: "description", content: "Recarregue seu TIM via PIX em segundos. 100% seguro, 24/7, com bônus exclusivos." },
    ],
  }),
  component: HomePage,
});

const features = [
  { icon: Zap, title: "Recarga Instantânea", description: "Sua recarga é processada em segundos, sem complicações e sem espera." },
  { icon: Shield, title: "100% Seguro", description: "Proteção total dos seus dados com criptografia avançada e certificada." },
  { icon: Clock, title: "Disponível 24/7", description: "Faça sua recarga a qualquer hora, de qualquer lugar do Brasil." },
  { icon: CreditCard, title: "Diversas Formas de Pagamento", description: "PIX, cartão de crédito, débito e muito mais opções para você." },
];

const benefits = [
  { icon: Wifi, title: "Internet Bônus", text: "Ganhe internet bônus em recargas acima de R$20." },
  { icon: Star, title: "Programa de Pontos", text: "Acumule pontos a cada recarga e troque por prêmios." },
  { icon: Gift, title: "Promoções Exclusivas", text: "Ofertas especiais toda semana para clientes recarga." },
];

const rechargeButtonClass =
  "h-[50px] rounded-[14px] border-0 bg-[#ececef] px-6 text-[14px] font-normal leading-none text-primary shadow-none hover:bg-[#e2e5ea] font-sans";

function HomePage() {
  return (
    <main>
      <section className="tim-hero relative min-h-[80vh] flex items-center overflow-hidden pt-24 pb-0">
        <div className="section-container relative z-10 flex flex-col lg:flex-row items-center gap-8 pt-16 pb-0">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="mx-auto flex-1 max-w-[22rem] text-center sm:max-w-xl lg:mx-0 lg:text-left"
          >
            <span className="tim-badge mb-6 inline-block text-primary-foreground/80">
              Recarga TIM
            </span>
            <h1 className="mb-6 text-3xl font-light leading-[1.2] text-primary-foreground sm:text-4xl lg:text-5xl">
              Conheça os benefícios dos canais de recarga TIM
            </h1>
            <div className="mt-8 flex justify-center lg:justify-start">
              <Button size="lg" variant="tim" className={rechargeButtonClass} asChild>
                <Link
                  to="/recarga"
                  search={(previous) => ({ ...previous, step: undefined })}
                >
                  Recarregar meu TIM
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 flex justify-center lg:justify-end"
          >
            <img
              src={timWoman}
              alt="Mulher feliz usando celular TIM"
              className="w-72 sm:w-80 lg:w-[30rem] object-contain drop-shadow-2xl"
            />
          </motion.div>
        </div>

        <div className="absolute top-1/4 right-1/3 w-3 h-3 rounded-full animate-float opacity-80" style={{ background: "hsl(45 100% 60%)" }} />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full animate-float opacity-60" style={{ background: "hsl(45 100% 70%)", animationDelay: "1s" }} />
        <div className="absolute bottom-1/3 right-1/3 w-2.5 h-2.5 rounded-full animate-float opacity-70" style={{ background: "hsl(45 100% 60%)", animationDelay: "0.5s" }} />
      </section>

      <section className="pt-16 pb-20">
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeUp} custom={0} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Benefícios da Recarga TIM</h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">Aproveite vantagens exclusivas ao recarregar pelo nosso site.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((benefit, i) => (
              <motion.div key={benefit.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} custom={i + 1} className="tim-card text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-lg">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary">
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeUp} custom={0} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Por que escolher a gente?</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={fadeUp} custom={i + 1} className="tim-card">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 tim-section-blue">
        <div className="section-container text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">Pronto para recarregar?</h2>
            <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">Recarregue agora mesmo e aproveite todos os benefícios TIM.</p>
            <Button size="lg" variant="tim" className={rechargeButtonClass} asChild>
              <Link
                to="/recarga"
                search={(previous) => ({ ...previous, step: undefined })}
              >
                Recarregar meu TIM
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
