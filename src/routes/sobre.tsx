import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Target, Eye, Heart, Users, Award, TrendingUp } from "lucide-react";
import { fadeUp } from "@/lib/animations";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a TIM — Recarga TIM" },
      { name: "description", content: "Conheça nossa missão, visão e valores. A plataforma de recarga mais confiável do Brasil." },
    ],
  }),
  component: AboutPage,
});

const values = [
  { icon: Target, title: "Missão", text: "Facilitar o acesso à recarga de celular TIM com praticidade, segurança e velocidade." },
  { icon: Eye, title: "Visão", text: "Ser a plataforma de recarga mais confiável e acessível do Brasil." },
  { icon: Heart, title: "Valores", text: "Transparência, inovação, foco no cliente e compromisso com a qualidade." },
];

const stats = [
  { icon: Users, value: "50K+", label: "Clientes atendidos" },
  { icon: Award, value: "99.9%", label: "Uptime garantido" },
  { icon: TrendingUp, value: "1M+", label: "Recargas realizadas" },
];

function AboutPage() {
  return (
    <main>
      <section className="tim-hero pt-20 md:pt-[5.5rem] pb-16 md:pb-20">
        <div className="section-container">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <span className="tim-badge mb-4 inline-block">Sobre Nós</span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-primary-foreground mb-6">Conheça a Recarga TIM</h1>
            <p className="text-lg text-primary-foreground/70 leading-relaxed">
              Somos uma plataforma dedicada a oferecer a melhor experiência em recarga de celular TIM. Com tecnologia de ponta e atendimento humanizado, garantimos praticidade e segurança.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className="tim-card text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 tim-section-blue">
        <div className="section-container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <stat.icon className="w-8 h-8 text-primary-foreground/80 mx-auto mb-3" />
                <p className="text-4xl font-extrabold text-primary-foreground">{stat.value}</p>
                <p className="text-primary-foreground/60 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="section-container max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl font-bold text-foreground mb-6">Nossa História</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>A Recarga TIM nasceu da necessidade de simplificar o processo de recarga de celular. Observamos que muitas pessoas enfrentavam dificuldades com métodos tradicionais e decidimos criar uma solução moderna e acessível.</p>
              <p>Desde o início, investimos em tecnologia e segurança para garantir que cada transação seja rápida, confiável e protegida. Nossa equipe trabalha diariamente para melhorar a experiência dos nossos clientes.</p>
              <p>Hoje, somos referência em recarga digital, atendendo milhares de clientes em todo o Brasil com compromisso e excelência.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
